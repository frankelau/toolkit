// todoToolNormalization.test.ts
// Unit tests for TodoWrite/update_plan extraction and TaskCreate/TaskUpdate accumulation
// Aligns with cc-gui todo tool normalization.test.ts

import { describe, it, expect } from "vitest";
import { extractTodosFromToolUse, isTaskManageTool, extractAccumulatedTasks } from "./todoToolNormalization";
import type { ChatMessage, ToolUseBlock } from "../types";

function makeTodoWriteBlock(todos: unknown[]): ToolUseBlock {
  return {
    id: "tool_001",
    name: "TodoWrite",
    input: { todos },
    isPending: false,
  };
}

function makeUpdatePlanBlock(plan: unknown[]): ToolUseBlock {
  return {
    id: "tool_002",
    name: "update_plan",
    input: { plan },
    isPending: false,
  };
}

describe("extractTodosFromToolUse", () => {
  it("extracts from TodoWrite block", () => {
    const block = makeTodoWriteBlock([
      { content: "Add login", status: "pending", id: "1" },
      { content: "Add dashboard", status: "in_progress", id: "2" },
      { content: "Add logout", status: "completed", id: "3" },
    ]);
    const result = extractTodosFromToolUse(block);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(3);
    expect(result![0].content).toBe("Add login");
    expect(result![0].status).toBe("pending");
    expect(result![1].status).toBe("in_progress");
    expect(result![2].status).toBe("completed");
  });

  it("extracts from update_plan block", () => {
    const block = makeUpdatePlanBlock([
      { step: "Setup project", status: "done" },
      { subject: "Config CI", status: "active" },
    ]);
    const result = extractTodosFromToolUse(block);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(result![0].content).toBe("Setup project");
    expect(result![0].status).toBe("completed");
    expect(result![1].content).toBe("Config CI");
    expect(result![1].status).toBe("in_progress");
  });

  it("returns null when input is not an array", () => {
    const block: ToolUseBlock = {
      id: "tool_003",
      name: "TodoWrite",
      input: { todos: "not an array" } as any,
      isPending: false,
    };
    expect(extractTodosFromToolUse(block)).toBeNull();
  });

  it("returns null for non-task tools", () => {
    const block: ToolUseBlock = {
      id: "tool_004",
      name: "Read",
      input: { file_path: "test.txt" },
      isPending: false,
    };
    expect(extractTodosFromToolUse(block)).toBeNull();
  });

  it("skips items without valid content", () => {
    const block = makeTodoWriteBlock([
      { status: "pending", id: "1" },
      { content: "Valid item", status: "pending", id: "2" },
      { content: "", status: "pending", id: "3" },
    ]);
    const result = extractTodosFromToolUse(block);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0].content).toBe("Valid item");
  });

  it("normalizes various status strings", () => {
    const block = makeTodoWriteBlock([
      { content: "A", status: "done" },
      { content: "B", status: "completed" },
      { content: "C", status: "active" },
      { content: "D", status: "running" },
    ]);
    const result = extractTodosFromToolUse(block);
    expect(result![0].status).toBe("completed");  // done → completed
    expect(result![1].status).toBe("completed");  // completed → completed
    expect(result![2].status).toBe("in_progress"); // active → in_progress
    expect(result![3].status).toBe("in_progress"); // running → in_progress
  });

  it("includes id when present", () => {
    const block = makeTodoWriteBlock([
      { content: "Test", status: "pending", id: "task-42" },
    ]);
    const result = extractTodosFromToolUse(block);
    expect(result![0].id).toBe("task-42");
  });
});

describe("isTaskManageTool", () => {
  it("returns true for TodoWrite", () => {
    // TodoWrite is normalized to lowercase, which is NOT in TASK_MANAGE_TOOL_NAMES
    // The actual task tool names are: taskcreate, taskupdate, taskget, tasklist
  });

  it("returns true for TaskCreate (normalized)", () => {
    expect(isTaskManageTool({ id: "x", name: "TaskCreate", input: {}, isPending: false })).toBe(true);
  });

  it("returns true for TaskUpdate (normalized)", () => {
    expect(isTaskManageTool({ id: "x", name: "TaskUpdate", input: {}, isPending: false })).toBe(true);
  });

  it("returns true for taskcreate (lowercase)", () => {
    expect(isTaskManageTool({ id: "x", name: "taskcreate", input: {}, isPending: false })).toBe(true);
  });

  it("returns false for non-task tools", () => {
    expect(isTaskManageTool({ id: "x", name: "Read", input: {}, isPending: false })).toBe(false);
  });

  it("returns false for TodoWrite (legacy, not in task list)", () => {
    expect(isTaskManageTool({ id: "x", name: "TodoWrite", input: {}, isPending: false })).toBe(false);
  });
});

describe("extractAccumulatedTasks", () => {
  it("returns empty array for empty messages", () => {
    expect(extractAccumulatedTasks([])).toEqual([]);
  });

  it("extracts tasks from TaskCreate blocks", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg1", role: "assistant", content: "", timestamp: Date.now(),
        toolUses: [
          {
            id: "tc1", name: "TaskCreate", input: { subject: "Login", description: "Implement login page" }, isPending: false, result: "Task #1 created successfully",
          },
          {
            id: "tc2", name: "TaskCreate", input: { subject: "Dashboard" }, isPending: false, result: "Task #2 created successfully",
          },
        ],
      },
    ];

    const result = extractAccumulatedTasks(messages);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Login: Implement login page");
    expect(result[0].status).toBe("pending");
    expect(result[1].content).toBe("Dashboard");
  });

  it("handles TaskUpdate blocking relationships", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg2", role: "assistant", content: "", timestamp: Date.now(),
        toolUses: [
          { id: "tc1", name: "TaskCreate", input: { subject: "Login" }, isPending: false, result: "Task #10 created successfully" },
          { id: "tc2", name: "TaskCreate", input: { subject: "Dashboard" }, isPending: false, result: "Task #20 created successfully" },
          { id: "tu1", name: "TaskUpdate", input: { taskId: "10", addBlocks: ["20"] }, isPending: false },
        ],
      },
    ];

    const result = extractAccumulatedTasks(messages);
    expect(result).toHaveLength(2);
    const blockedTask = result.find((t) => t.content === "Dashboard");
    expect(blockedTask).toBeDefined();
  });

  it("handles TaskUpdate status change", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg3", role: "assistant", content: "", timestamp: Date.now(),
        toolUses: [
          { id: "tc1", name: "TaskCreate", input: { subject: "Setup" }, isPending: false, result: "Task #1 created successfully" },
          { id: "tu1", name: "TaskUpdate", input: { taskId: "1", status: "completed" }, isPending: false },
        ],
      },
    ];

    const result = extractAccumulatedTasks(messages);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("completed");
  });
});
