export const TIMEZONE_LIST = [
  { id: "local", label: "本地", tz: undefined as string | undefined },
  { id: "utc",    label: "UTC",   tz: "UTC" },
  { id: "sh",     label: "上海",  tz: "Asia/Shanghai" },
  { id: "tokyo",  label: "东京",  tz: "Asia/Tokyo" },
  { id: "ny",     label: "纽约",  tz: "America/New_York" },
  { id: "london", label: "伦敦",  tz: "Europe/London" },
  { id: "paris",  label: "巴黎",  tz: "Europe/Paris" },
  { id: "moscow", label: "莫斯科",tz: "Europe/Moscow" },
  { id: "dubai",  label: "迪拜",  tz: "Asia/Dubai" },
  { id: "delhi",  label: "新德里",tz: "Asia/Kolkata" },
  { id: "sydney", label: "悉尼",  tz: "Australia/Sydney" },
  { id: "la",     label: "洛杉矶",tz: "America/Los_Angeles" },
] as const;
