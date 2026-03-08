/** Mock athlete profile data */
export const MOCK_ATHLETE = {
  ftp: 260,
  weight: 72,
  maxHR: 186,
  restingHR: 48,
  powerZones: [
    { zone: 1, name: "Active Recovery", min: 0, max: 143 },
    { zone: 2, name: "Endurance", min: 143, max: 195 },
    { zone: 3, name: "Tempo", min: 195, max: 234 },
    { zone: 4, name: "Threshold", min: 234, max: 273 },
    { zone: 5, name: "VO2max", min: 273, max: 312 },
    { zone: 6, name: "Anaerobic", min: 312, max: 390 },
    { zone: 7, name: "Neuromuscular", min: 390, max: 9999 },
  ],
};

export const MOCK_CURRENT_CTL = 48;
export const MOCK_PROJECTED_CTL = 72;
