import { useMemo, useEffect, useRef } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { saveTextWithDialog } from "../saveFile";
import { toast } from "../useCopyFeedback";
import "./LoanCalc.css";

function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 100 / 12;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

function findRate(principal: number, payment: number, months: number): number | null {
  if (payment * months <= principal) return null;
  let lo = 0.001, hi = 200;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const p = monthlyPayment(principal, mid, months);
    if (p < payment) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

type Row = { n: number; payment: number; principal: number; interest: number; remaining: number };

function equalPrincipalSchedule(principal: number, annualRate: number, months: number) {
  const r = annualRate / 100 / 12;
  const monthlyPrin = principal / months;
  let rem = principal;
  const schedule: Row[] = [];
  for (let i = 1; i <= months; i++) {
    const intPart = rem * r;
    const payment = monthlyPrin + intPart;
    rem -= monthlyPrin;
    schedule.push({ n: i, payment, principal: monthlyPrin, interest: intPart, remaining: Math.max(0, rem) });
  }
  const total = schedule.reduce((s, r2) => s + r2.payment, 0);
  return { schedule, total, interest: total - principal, mp: schedule[0]!.payment };
}

/** 计算等额本息还款计划 */
function equalPaymentSchedule(principal: number, annualRate: number, months: number) {
  const mp = monthlyPayment(principal, annualRate, months);
  const r = annualRate / 100 / 12;
  let rem = principal;
  const schedule: Row[] = [];
  for (let i = 1; i <= months; i++) {
    const intPart = rem * r;
    const prinPart = mp - intPart;
    rem -= prinPart;
    schedule.push({ n: i, payment: mp, principal: prinPart, interest: intPart, remaining: Math.max(0, rem) });
  }
  const total = mp * months;
  return { schedule, total, interest: total - principal, mp };
}

function fmt(n: number) { return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const CHART_MONTHS = 60;

/** F26 贷款利率计算器 */
export default function LoanCalc({ instanceId }: ToolProps) {
  const ns = `loan:${instanceId}`;
  const [mode, setMode] = usePersistentState<"forward" | "reverse" | "combo">(`${ns}:mode`, "forward");
  const [repayType, setRepayType] = usePersistentState<"equal-payment" | "equal-principal" | "compare">(`${ns}:rt`, "equal-payment");
  const [principal, setPrincipal] = usePersistentState(`${ns}:p`, "1000000");
  const [rate, setRate] = usePersistentState(`${ns}:r`, "4.5");
  const [months, setMonths] = usePersistentState(`${ns}:m`, "240");
  const [payment, setPayment] = usePersistentState(`${ns}:pay`, "");

  // 组合贷款：公积金
  const [hfPrincipal, setHfPrincipal] = usePersistentState(`${ns}:hfp`, "800000");
  const [hfRate, setHfRate] = usePersistentState(`${ns}:hfr`, "2.85");
  // 组合贷款：商贷
  const [cmPrincipal, setCmPrincipal] = usePersistentState(`${ns}:cmp`, "700000");
  const [cmRate, setCmRate] = usePersistentState(`${ns}:cmr`, "3.5");
  // 组合贷款：期数
  const [comboMonths, setComboMonths] = usePersistentState(`${ns}:cm`, "300");

  const P = parseFloat(principal), R = parseFloat(rate), M = parseInt(months), PAY = parseFloat(payment);
  const HFP = parseFloat(hfPrincipal), HFR = parseFloat(hfRate), CMP = parseFloat(cmPrincipal), CMR = parseFloat(cmRate), CM = parseInt(comboMonths);

  const result = useMemo(() => {
    if (mode === "forward") {
      if (!P || !R || !M || M < 1) return null;
      if (repayType === "equal-payment" || repayType === "compare") {
        const mp = monthlyPayment(P, R, M);
        const total = mp * M;
        const interest = total - P;
        const r = R / 100 / 12;
        let rem = P;
        const schedule: Row[] = [];
        for (let i = 1; i <= M; i++) {
          const intPart = rem * r;
          const prinPart = mp - intPart;
          rem -= prinPart;
          schedule.push({ n: i, payment: mp, principal: prinPart, interest: intPart, remaining: Math.max(0, rem) });
        }
        const ep = repayType === "compare" ? equalPrincipalSchedule(P, R, M) : null;
        return { type: "forward" as const, mp, total, interest, schedule, ep };
      } else {
        const { schedule, total, interest, mp } = equalPrincipalSchedule(P, R, M);
        return { type: "forward" as const, mp, total, interest, schedule, ep: null };
      }
    } else if (mode === "reverse") {
      if (!P || !PAY || !M) return null;
      const r = findRate(P, PAY, M);
      if (!r) return null;
      return { type: "reverse" as const, rate: r, total: PAY * M, interest: PAY * M - P };
    } else {
      // combo mode
      if (!HFP || !HFR || !CMP || !CMR || !CM || CM < 1) return null;
      const isEP = repayType === "equal-principal";
      const hf = isEP ? equalPrincipalSchedule(HFP, HFR, CM) : equalPaymentSchedule(HFP, HFR, CM);
      const cm = isEP ? equalPrincipalSchedule(CMP, CMR, CM) : equalPaymentSchedule(CMP, CMR, CM);
      const comboMp = hf.mp + cm.mp;
      const comboTotal = hf.total + cm.total;
      const comboInterest = hf.interest + cm.interest;
      // 合并还款计划
      const comboSchedule: Row[] = [];
      for (let i = 0; i < CM; i++) {
        const h = hf.schedule[i]!;
        const c = cm.schedule[i]!;
        comboSchedule.push({
          n: i + 1,
          payment: h.payment + c.payment,
          principal: h.principal + c.principal,
          interest: h.interest + c.interest,
          remaining: Math.max(0, h.remaining + c.remaining),
        });
      }
      // 对比模式
      let cmp: { epMp: number; epTotal: number; epInterest: number; epFirst: number; epLast: number } | null = null;
      if (repayType === "compare") {
        const hfEp = equalPrincipalSchedule(HFP, HFR, CM);
        const cmEp = equalPrincipalSchedule(CMP, CMR, CM);
        cmp = {
          epMp: hfEp.mp + cmEp.mp,
          epTotal: hfEp.total + cmEp.total,
          epInterest: hfEp.interest + cmEp.interest,
          epFirst: hfEp.mp + cmEp.mp,
          epLast: (hfEp.schedule[CM - 1]!.payment) + (cmEp.schedule[CM - 1]!.payment),
        };
      }
      return {
        type: "combo" as const,
        hfMp: hf.mp, hfTotal: hf.total, hfInterest: hf.interest, hfSchedule: hf.schedule,
        cmMp: cm.mp, cmTotal: cm.total, cmInterest: cm.interest, cmSchedule: cm.schedule,
        comboMp, comboTotal, comboInterest,
        schedule: comboSchedule,
        cmp,
      };
    }
  }, [mode, P, R, M, PAY, repayType, HFP, HFR, CMP, CMR, CM]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    if (result.type !== "forward" && result.type !== "combo") return;
    if (!result.schedule.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const sched = result.schedule.slice(0, CHART_MONTHS);
    const maxPayment = Math.max(...sched.map(r => r.payment));
    const pad = { top: 20, right: 10, bottom: 30, left: 55 };
    const cw = W - pad.left - pad.right, ch = H - pad.top - pad.bottom;
    const barW = cw / sched.length;

    ctx.strokeStyle = "#e5e5e5"; ctx.lineWidth = 1;
    ctx.font = "10px sans-serif"; ctx.fillStyle = "#aaa"; ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const v = maxPayment * i / 4;
      const y = pad.top + ch - ch * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cw, y); ctx.stroke();
      ctx.fillText((v / 10000).toFixed(1) + "万", pad.left - 4, y + 3);
    }

    if (result.type === "combo") {
      // 组合贷款：堆叠三段（公积金本金、商贷本金、利息）
      sched.forEach((r, i) => {
        const x = pad.left + i * barW;
        const hfRow = result.hfSchedule[i] || result.hfSchedule[result.hfSchedule.length - 1]!;
        const cmRow = result.cmSchedule[i] || result.cmSchedule[result.cmSchedule.length - 1]!;
        const intH = ch * r.interest / maxPayment;
        const hfPrinH = ch * hfRow.principal / maxPayment;
        const cmPrinH = ch * cmRow.principal / maxPayment;
        ctx.fillStyle = "#f5a623"; // 利息
        ctx.fillRect(x + 1, pad.top + ch - intH, barW - 2, intH);
        ctx.fillStyle = "#3b9eff"; // 公积金本金
        ctx.fillRect(x + 1, pad.top + ch - intH - hfPrinH, barW - 2, hfPrinH);
        ctx.fillStyle = "#2ecc71"; // 商贷本金
        ctx.fillRect(x + 1, pad.top + ch - intH - hfPrinH - cmPrinH, barW - 2, cmPrinH);
      });
      // 图例
      ctx.fillStyle = "#3b9eff"; ctx.fillRect(pad.left, pad.top - 14, 10, 8);
      ctx.fillStyle = "#aaa"; ctx.textAlign = "left"; ctx.font = "10px sans-serif";
      ctx.fillText("公积金本金", pad.left + 12, pad.top - 7);
      ctx.fillStyle = "#2ecc71"; ctx.fillRect(pad.left + 70, pad.top - 14, 10, 8);
      ctx.fillStyle = "#aaa"; ctx.fillText("商贷本金", pad.left + 82, pad.top - 7);
      ctx.fillStyle = "#f5a623"; ctx.fillRect(pad.left + 130, pad.top - 14, 10, 8);
      ctx.fillStyle = "#aaa"; ctx.fillText("利息", pad.left + 142, pad.top - 7);
    } else {
      // 单笔贷款：堆叠两段（本金、利息）
      sched.forEach((r, i) => {
        const x = pad.left + i * barW;
        const intH = ch * r.interest / maxPayment;
        const prinH = ch * r.principal / maxPayment;
        ctx.fillStyle = "#f5a623";
        ctx.fillRect(x + 1, pad.top + ch - intH, barW - 2, intH);
        ctx.fillStyle = "#3b9eff";
        ctx.fillRect(x + 1, pad.top + ch - intH - prinH, barW - 2, prinH);
      });
      ctx.fillStyle = "#3b9eff"; ctx.fillRect(pad.left, pad.top - 14, 10, 8);
      ctx.fillStyle = "#aaa"; ctx.textAlign = "left"; ctx.font = "10px sans-serif";
      ctx.fillText("本金", pad.left + 12, pad.top - 7);
      ctx.fillStyle = "#f5a623"; ctx.fillRect(pad.left + 45, pad.top - 14, 10, 8);
      ctx.fillStyle = "#aaa"; ctx.fillText("利息", pad.left + 57, pad.top - 7);
    }

    ctx.fillStyle = "#aaa"; ctx.textAlign = "center";
    [0, Math.floor(sched.length / 4), Math.floor(sched.length / 2), Math.floor(sched.length * 3 / 4), sched.length - 1].forEach(i => {
      if (sched[i]) ctx.fillText(`${sched[i].n}期`, pad.left + i * barW + barW / 2, H - pad.bottom + 16);
    });
  }, [result]);

  async function exportCsv() {
    if (!result) return;
    if (result.type === "forward" && result.schedule) {
      const header = "期次,月供,还本金,还利息,剩余本金";
      const rows = result.schedule.map(r =>
        `${r.n},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.remaining.toFixed(2)}`
      );
      const res = await saveTextWithDialog([header, ...rows].join("\n"), "loan-schedule.csv");
      if (res.saved) toast("已保存到 " + res.path, "success");
    } else if (result.type === "combo" && result.schedule) {
      const header = "期次,公积金月供,公积金还本金,公积金还利息,商贷月供,商贷还本金,商贷还利息,合计月供,合计还本金,合计还利息,剩余本金";
      const rows = result.schedule.map((r, i) => {
        const hf = result.hfSchedule[i]!;
        const cm = result.cmSchedule[i]!;
        return `${r.n},${hf.payment.toFixed(2)},${hf.principal.toFixed(2)},${hf.interest.toFixed(2)},${cm.payment.toFixed(2)},${cm.principal.toFixed(2)},${cm.interest.toFixed(2)},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.remaining.toFixed(2)}`;
      });
      const res = await saveTextWithDialog([header, ...rows].join("\n"), "combo-loan-schedule.csv");
      if (res.saved) toast("已保存到 " + res.path, "success");
    }
  }

  return (
    <div className="lc-tool">
      <div className="lc-mode-bar">
        <button className={mode === "forward" ? "on" : ""} onClick={() => setMode("forward")}>按利率算月供</button>
        <button className={mode === "reverse" ? "on" : ""} onClick={() => setMode("reverse")}>按月供反推利率</button>
        <button className={mode === "combo" ? "on" : ""} onClick={() => setMode("combo")}>组合贷款</button>
      </div>
      {(mode === "forward" || mode === "combo") && (
        <div className="lc-repay-bar">
          <button className={repayType === "equal-payment" ? "on" : ""} onClick={() => setRepayType("equal-payment")}>等额本息</button>
          <button className={repayType === "equal-principal" ? "on" : ""} onClick={() => setRepayType("equal-principal")}>等额本金</button>
          <button className={repayType === "compare" ? "on" : ""} onClick={() => setRepayType("compare")}>对比</button>
        </div>
      )}

      {mode === "combo" ? (
        <>
          <div className="lc-combo-inputs">
            <div className="lc-combo-col">
              <div className="lc-combo-title">公积金贷款</div>
              <label>贷款金额 (元)
                <input type="number" value={hfPrincipal} onChange={(e) => setHfPrincipal(e.target.value)} />
              </label>
              <label>年利率 (%)
                <input type="number" step="0.01" value={hfRate} onChange={(e) => setHfRate(e.target.value)} />
              </label>
            </div>
            <div className="lc-combo-col">
              <div className="lc-combo-title">商业贷款</div>
              <label>贷款金额 (元)
                <input type="number" value={cmPrincipal} onChange={(e) => setCmPrincipal(e.target.value)} />
              </label>
              <label>年利率 (%)
                <input type="number" step="0.01" value={cmRate} onChange={(e) => setCmRate(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="lc-inputs">
            <label>还款期数 (月)
              <input type="number" value={comboMonths} onChange={(e) => setComboMonths(e.target.value)} />
            </label>
            <label style={{ opacity: 0.4 }}>≈ 年
              <input readOnly value={(parseInt(comboMonths) / 12).toFixed(1)} />
            </label>
            <label style={{ opacity: 0.4 }}>贷款总额
              <input readOnly value={"¥ " + fmt((HFP || 0) + (CMP || 0))} />
            </label>
          </div>
        </>
      ) : (
        <div className="lc-inputs">
          <label>贷款金额 (元)
            <input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </label>
          {mode === "forward" ? (
            <label>年利率 (%)
              <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
          ) : (
            <label>月还款额 (元)
              <input type="number" value={payment} onChange={(e) => setPayment(e.target.value)} />
            </label>
          )}
          <label>还款期数 (月)
            <input type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
          </label>
          <label style={{ opacity: 0.4 }}>≈ 年
            <input readOnly value={(parseInt(months) / 12).toFixed(1)} />
          </label>
        </div>
      )}

      {result && (
        <>
          {mode === "combo" && result.type === "combo" && (
            <>
              {/* 汇总卡片 */}
              <div className="lc-summary">
                <div className="lc-kv"><span>组合月供</span><strong>¥ {fmt(result.comboMp)}</strong></div>
                <div className="lc-kv"><span>还款总额</span><strong>¥ {fmt(result.comboTotal)}</strong></div>
                <div className="lc-kv"><span>支付利息</span><strong className="lc-interest">¥ {fmt(result.comboInterest)}</strong></div>
              </div>

              {/* 分项卡片 */}
              <div className="lc-combo-breakdown">
                <div className="lc-combo-card">
                  <div className="lc-combo-card-title">公积金贷款</div>
                  <div className="lc-kv"><span>月供</span><strong>¥ {fmt(result.hfMp)}</strong></div>
                  <div className="lc-kv"><span>还款总额</span><strong>¥ {fmt(result.hfTotal)}</strong></div>
                  <div className="lc-kv"><span>支付利息</span><strong className="lc-interest">¥ {fmt(result.hfInterest)}</strong></div>
                </div>
                <div className="lc-combo-card">
                  <div className="lc-combo-card-title">商业贷款</div>
                  <div className="lc-kv"><span>月供</span><strong>¥ {fmt(result.cmMp)}</strong></div>
                  <div className="lc-kv"><span>还款总额</span><strong>¥ {fmt(result.cmTotal)}</strong></div>
                  <div className="lc-kv"><span>支付利息</span><strong className="lc-interest">¥ {fmt(result.cmInterest)}</strong></div>
                </div>
              </div>

              {/* 对比表 */}
              {repayType === "compare" && result.cmp && (
                <div className="lc-compare">
                  <table className="lc-cmp-table">
                    <thead><tr><th></th><th>等额本息</th><th>等额本金</th></tr></thead>
                    <tbody>
                      <tr><td>首月月供</td><td>¥ {fmt(result.comboMp)}</td><td>¥ {fmt(result.cmp.epFirst)}</td></tr>
                      <tr><td>末月月供</td><td>¥ {fmt(result.comboMp)}</td><td>¥ {fmt(result.cmp.epLast)}</td></tr>
                      <tr><td>还款总额</td><td>¥ {fmt(result.comboTotal)}</td><td>¥ {fmt(result.cmp.epTotal)}</td></tr>
                      <tr><td className="lc-int">支付利息</td><td className="lc-int">¥ {fmt(result.comboInterest)}</td><td className="lc-int">¥ {fmt(result.cmp.epInterest)}</td></tr>
                      <tr><td>节省利息</td><td colSpan={2} className="lc-save">等额本金少付 ¥ {fmt(result.comboInterest - result.cmp.epInterest)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* 工具栏 */}
              <div className="lc-toolbar">
                <button onClick={exportCsv} disabled={!result.schedule.length}>导出 CSV</button>
              </div>

              {/* 柱状图 */}
              {result.schedule.length > 0 && (
                <canvas ref={canvasRef} className="lc-chart" />
              )}

              {/* 还款明细表 */}
              <div className="lc-table-wrap">
                <table className="lc-table">
                  <thead><tr>
                    <th>期次</th>
                    <th>公积金月供</th><th>公积金还本金</th><th className="lc-int">公积金还利息</th>
                    <th>商贷月供</th><th>商贷还本金</th><th className="lc-int">商贷还利息</th>
                    <th>合计月供</th><th>合计还本金</th><th className="lc-int">合计还利息</th>
                    <th>剩余本金</th>
                  </tr></thead>
                  <tbody>
                    {result.schedule.map((r, i) => {
                      const hf = result.hfSchedule[i]!;
                      const cm = result.cmSchedule[i]!;
                      return (
                        <tr key={r.n}>
                          <td>{r.n}</td>
                          <td>{fmt(hf.payment)}</td><td>{fmt(hf.principal)}</td><td className="lc-int">{fmt(hf.interest)}</td>
                          <td>{fmt(cm.payment)}</td><td>{fmt(cm.principal)}</td><td className="lc-int">{fmt(cm.interest)}</td>
                          <td>{fmt(r.payment)}</td><td>{fmt(r.principal)}</td><td className="lc-int">{fmt(r.interest)}</td>
                          <td>{fmt(r.remaining)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {repayType === "compare" && result.type === "forward" && result.ep ? (
            <div className="lc-compare">
              <table className="lc-cmp-table">
                <thead><tr><th></th><th>等额本息</th><th>等额本金</th></tr></thead>
                <tbody>
                  <tr><td>首月月供</td><td>¥ {fmt(result.mp)}</td><td>¥ {fmt(result.ep.mp)}</td></tr>
                  <tr><td>末月月供</td><td>¥ {fmt(result.mp)}</td><td>¥ {fmt(result.ep.schedule[result.ep.schedule.length - 1]!.payment)}</td></tr>
                  <tr><td>还款总额</td><td>¥ {fmt(result.total)}</td><td>¥ {fmt(result.ep.total)}</td></tr>
                  <tr><td className="lc-int">支付利息</td><td className="lc-int">¥ {fmt(result.interest)}</td><td className="lc-int">¥ {fmt(result.ep.interest)}</td></tr>
                  <tr><td>节省利息</td><td colSpan={2} className="lc-save">等额本金少付 ¥ {fmt(result.interest - result.ep.interest)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : result.type === "forward" ? (
            <div className="lc-summary">
              <div className="lc-kv"><span>{repayType === "equal-principal" ? "首月月供" : "月供"}</span><strong>¥ {fmt(result.mp)}</strong></div>
              <div className="lc-kv"><span>还款总额</span><strong>¥ {fmt(result.total)}</strong></div>
              <div className="lc-kv"><span>支付利息</span><strong className="lc-interest">¥ {fmt(result.interest)}</strong></div>
            </div>
          ) : result.type === "reverse" ? (
            <div className="lc-summary">
              <div className="lc-kv"><span>年利率</span><strong>{result.rate.toFixed(4)} %</strong></div>
              <div className="lc-kv"><span>还款总额</span><strong>¥ {fmt(result.total)}</strong></div>
              <div className="lc-kv"><span>支付利息</span><strong className="lc-interest">¥ {fmt(result.interest)}</strong></div>
            </div>
          ) : null}

          {result.type === "forward" && (
            <>
              <div className="lc-toolbar">
                <button onClick={exportCsv} disabled={!result.schedule.length}>导出 CSV</button>
              </div>
              {result.schedule.length > 0 && (
                <canvas ref={canvasRef} className="lc-chart" />
              )}
              <div className="lc-table-wrap">
                <table className="lc-table">
                  <thead><tr><th>期次</th><th>月供</th><th>还本金</th><th>还利息</th><th>剩余本金</th></tr></thead>
                  <tbody>
                    {result.schedule.map((r) => (
                      <tr key={r.n}>
                        <td>{r.n}</td><td>{fmt(r.payment)}</td><td>{fmt(r.principal)}</td>
                        <td className="lc-int">{fmt(r.interest)}</td><td>{fmt(r.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
