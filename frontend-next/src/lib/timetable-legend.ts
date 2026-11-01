export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayName = (typeof DAY_NAMES)[number];

export const TIMETABLE_TIME_SLOTS = [
  "09:00–10:00",
  "10:00–11:00",
  "11:30–12:30",
  "12:30–13:30",
  "14:30–15:30",
  "15:30–16:30",
];

export const TIMETABLE_LEGEND: Record<
  string,
  {
    subject_name: string;
    short_code: string;
    faculty_name: string;
    room: string;
    kind?: string;
  }
> = {
  "CS233AI": {
    subject_name: "Data Structures and Applications",
    short_code: "AI / RP",
    faculty_name: "Prof. Anitha I & Prof. Rashmi P",
    room: "CS-301",
    kind: "lecture",
  },
  "DSA Lab": {
    subject_name: "Data Structures and Applications Laboratory",
    short_code: "AI and RP",
    faculty_name: "Prof. Anitha I & Prof. Rashmi P",
    room: "Programming Lab-1",
    kind: "lab",
  },
  "CI234AI": {
    subject_name: "Digital Design and Computer Organization",
    short_code: "SN / KVR",
    faculty_name: "Dr. Somesh Nandi & Prof. K V Raghavendra",
    room: "CS-301",
    kind: "lecture",
  },
  "CPS Lab": {
    subject_name: "Cyber Physical Systems / Digital Design Lab",
    short_code: "SN and KVR",
    faculty_name: "Dr. Somesh Nandi & Prof. K V Raghavendra",
    room: "CPS / IoT Lab",
    kind: "lab",
  },
  "CS235AT": {
    subject_name: "Operating Systems",
    short_code: "RKM",
    faculty_name: "Dr. Rajesh Kumar M",
    room: "CS-301",
    kind: "lecture",
  },
  "CS236AT": {
    subject_name: "Design and Analysis of Algorithms",
    short_code: "ASM",
    faculty_name: "Dr. Anitha S Murthy",
    room: "CS-301",
    kind: "lecture",
  },
  "CS238DL": {
    subject_name: "Ability Enhancement Course / Skill Development Lab",
    short_code: "VKP",
    faculty_name: "Prof. Vinay K Prasad",
    room: "AI & ML Lab",
    kind: "lab",
  },
  "MA231TF": {
    subject_name: "Statistics, Probability and Graph Theory",
    short_code: "SBM",
    faculty_name: "Dr. S B Mallikarjuna",
    room: "CS-301",
    kind: "lecture",
  },
  "MAT149AT": {
    subject_name: "Bridge Course Mathematics",
    short_code: "SBM",
    faculty_name: "Dr. S B Mallikarjuna",
    room: "CS-301",
    kind: "lecture",
  },
  "CV232TA/ME232TB/BT232TD": {
    subject_name:
      "Environment & Sustainability / Engineering Materials / Biology for Engineers",
    short_code: "dept",
    faculty_name: "Inter-Departmental Faculty",
    room: "CS-301",
    kind: "lecture",
  },
  "Counselling": {
    subject_name: "Student Mentoring & Academic Counselling",
    short_code: "DSN",
    faculty_name: "Dr. Somesh Nandi (Counselor)",
    room: "Faculty Cabin",
    kind: "other",
  },
};

export function normalizeDay(val: unknown): string {
  if (typeof val === "number" && val >= 1 && val <= 7) {
    return DAY_NAMES[val - 1];
  }
  const s = String(val ?? "").trim();
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 1 && num <= 7) {
    return DAY_NAMES[num - 1];
  }
  const lower = s.toLowerCase();
  for (const d of DAY_NAMES) {
    if (lower.startsWith(d.toLowerCase().slice(0, 3))) {
      return d;
    }
  }
  return "Monday";
}

export function normalizeDayNumber(val: unknown): number {
  if (typeof val === "number" && val >= 1 && val <= 7) {
    return val;
  }
  const s = String(val ?? "").trim();
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 1 && num <= 7) {
    return num;
  }
  const lower = s.toLowerCase();
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (lower.startsWith(DAY_NAMES[i].toLowerCase().slice(0, 3))) {
      return i + 1;
    }
  }
  return 1;
}

export function enrichTimetableSlot<T extends Record<string, unknown>>(
  slot: T,
): T & {
  day: string;
  day_num: number;
  subject: string;
  subject_name: string;
  short_code: string;
  faculty_name: string;
  room: string;
  kind: string;
  start_time: string;
  end_time: string;
} {
  const subj = String(slot.subject || slot.code || slot.subject_code || "Course").trim();
  let legend = TIMETABLE_LEGEND[subj];
  if (!legend) {
    for (const [k, v] of Object.entries(TIMETABLE_LEGEND)) {
      if (
        k.toLowerCase() === subj.toLowerCase() ||
        subj.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(subj.toLowerCase())
      ) {
        legend = v;
        break;
      }
    }
  }

  // Handle OCR quirks where initials were put into room
  let rawRoom = String(slot.room || "").trim();
  let rawShort = String(slot.short_code || slot.faculty_code || "").trim();
  if (
    (rawRoom === "AI and RP" || rawRoom === "SN and KVR") &&
    !rawShort
  ) {
    rawShort = rawRoom;
    rawRoom = "";
  }

  const dayName = normalizeDay(slot.day || slot.day_of_week);
  const dayNum = normalizeDayNumber(slot.day || slot.day_of_week);
  const startTime = String(slot.start_time || slot.start || "09:00").slice(0, 5);
  const endTime = String(slot.end_time || slot.end || "10:00").slice(0, 5);

  const subjectName = String(
    slot.subject_name || (legend ? legend.subject_name : subj),
  ).trim();

  const shortCode = String(
    rawShort || (legend ? legend.short_code : ""),
  ).trim();

  const facultyName = String(
    slot.faculty_name || slot.faculty || (legend ? legend.faculty_name : shortCode),
  ).trim();

  const room = String(
    rawRoom && rawRoom !== "Room TBA" && rawRoom !== "—" && rawRoom !== "TBA"
      ? rawRoom
      : legend
        ? legend.room
        : "CS-301",
  ).trim();

  const kind = String(
    slot.kind || (legend ? legend.kind : "lecture"),
  ).toLowerCase().trim();

  return {
    ...slot,
    day: dayName,
    day_num: dayNum,
    subject: subj,
    subject_name: subjectName,
    short_code: shortCode,
    faculty_name: facultyName,
    room,
    kind,
    start_time: startTime,
    end_time: endTime,
  };
}
