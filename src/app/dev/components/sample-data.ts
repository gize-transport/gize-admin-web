// Made-up data for the dev-only component gallery. Not real riders, drivers or routes.

export type SampleRoute = {
  id: string;
  code: string;
  name: string;
  type: "public" | "student" | "corporate";
  seatsTaken: number;
  seatsTotal: number;
  driver: string | null;
  status: "active" | "waitlist" | "paused" | "stopped";
};

export const sampleRoutes: SampleRoute[] = [
  {
    id: "r03",
    code: "R-03",
    name: "CMC → Mexico",
    type: "public",
    seatsTaken: 12,
    seatsTotal: 15,
    driver: "Tesfaye M.",
    status: "active",
  },
  {
    id: "r05",
    code: "R-05",
    name: "Gerji → Arat Kilo",
    type: "public",
    seatsTaken: 11,
    seatsTotal: 12,
    driver: "ሙሉ አለሙ",
    status: "active",
  },
  {
    id: "r07",
    code: "R-07",
    name: "Ayat → Kazanchis",
    type: "public",
    seatsTaken: 11,
    seatsTotal: 15,
    driver: "Tesfaye G.",
    status: "paused",
  },
  {
    id: "s02",
    code: "S-02",
    name: "Jemo → Bole school",
    type: "student",
    seatsTaken: 10,
    seatsTotal: 12,
    driver: "Samuel D.",
    status: "active",
  },
  {
    id: "c01",
    code: "C-01",
    name: "Ethio Logistics staff",
    type: "corporate",
    seatsTaken: 13,
    seatsTotal: 15,
    driver: "Yared B.",
    status: "active",
  },
  {
    id: "r11",
    code: "R-11",
    name: "Lebu → Piassa",
    type: "public",
    seatsTaken: 12,
    seatsTotal: 15,
    driver: "Abebe K.",
    status: "active",
  },
  {
    id: "s04",
    code: "S-04",
    name: "Kotebe → Safari school",
    type: "student",
    seatsTaken: 9,
    seatsTotal: 12,
    driver: "Getachew W.",
    status: "active",
  },
  {
    id: "r14",
    code: "R-14",
    name: "Summit → Mexico",
    type: "public",
    seatsTaken: 7,
    seatsTotal: 11,
    driver: null,
    status: "waitlist",
  },
  {
    id: "c02",
    code: "C-02",
    name: "Addis Pharma night shift",
    type: "corporate",
    seatsTaken: 6,
    seatsTotal: 15,
    driver: "Hanna T.",
    status: "stopped",
  },
  {
    id: "r16",
    code: "R-16",
    name: "Bole → Megenagna",
    type: "public",
    seatsTaken: 14,
    seatsTotal: 15,
    driver: "Dawit H.",
    status: "active",
  },
  {
    id: "s06",
    code: "S-06",
    name: "CMC → ICS school",
    type: "student",
    seatsTaken: 4,
    seatsTotal: 12,
    driver: null,
    status: "waitlist",
  },
  {
    id: "r18",
    code: "R-18",
    name: "Saris → Mexico",
    type: "public",
    seatsTaken: 15,
    seatsTotal: 15,
    driver: "Kidist A.",
    status: "active",
  },
];

export const sampleRequestId = "req_01JC8Y4F7T2M9QK3";
export const amharicSample = "አዲስ አበባ · ቦሌ";
export const plateSample = "3-A 41203";
export const pageSize = 5;
