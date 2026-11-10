/* club-demo: SAMPLE member data for the Good Neighbor Club member-area prototype (club-dashboard.html, club-refer.html).
   Made up, shown with a visible "sample account" note. No money rule lives here: credit, caps, check-in timing and the
   neighborhood threshold are computed by js/club-member.js from js/club-config.js. Only facts live here: what was done,
   when, for how much, and how far away. When a backend exists it returns this same shape for the signed-in member.
   Dates are 'YYYY-MM-DD' (or 'YYYY-MM' when only the month is known). `today` is fixed so the prototype reads the same
   every day; delete it to use the real date.
   photo (property, projects): { src (file in assets/), alt, w, h }; no photo = the record says "No photos on file yet".
   The photos are brand-hub stand-ins (they look generated), never a real client's home or job. */
window.COSMIC_CLUB_DEMO = {
  sample: true,
  today: '2026-11-10',
  member: { id: 'demo-carlos', first: 'Carlos', last: 'M.', lastCheckIn: null },
  property: {
    name: 'Zilker Family Home', area: 'Zilker', zip: '78704', type: 'Single-family home', built: 1962,
    /* photo: file in assets/ + alt + size; a stock house photo for the sample account (not a real client's home) */
    photo: { src: 'photo-house-exterior.jpg', alt: 'Sample property: a single-story home with a white garage door and a front lawn', w: 1448, h: 1086 }
  },
  /* the member's own completed projects, oldest first; the first one started the membership */
  projects: [
    {
      id: 'p1', name: 'Cabinet refresh', icon: 'cabinet', where: 'Kitchen', completed: '2025-11-14', warrantyMonths: 24,
      colors: [{ where: 'Cabinets', name: 'Pure White', code: 'SW 7005', hex: '#edece6' },
               { where: 'Island', name: 'Naval', code: 'SW 6244', hex: '#2f3d4c' }],
      finish: 'Satin urethane enamel, sprayed. New soft-close hinges.',
      photo: { src: 'photo-kitchen-after.jpg', alt: 'Cabinet refresh: white painted kitchen cabinets', w: 1672, h: 941 },
      notes: 'Leftover paint in the garage, shelf 2, labelled "kitchen".'
    },
    {
      id: 'p2', name: 'Deck work', icon: 'deck', where: 'Back yard', completed: '2026-03-20', warrantyMonths: 12,
      colors: [{ where: 'Deck boards', name: 'Cedar semi-transparent stain', code: '', hex: '#9a5b34' }],
      finish: 'Two boards replaced, all screws reset, stain in two coats.',
      notes: 'Re-stain every 2 to 3 years. Keep planters off the boards.'
    },
    {
      id: 'p3', name: 'Exterior repaint', icon: 'roller', where: 'Whole house', completed: '2026-05-22', warrantyMonths: 24,
      colors: [{ where: 'Body', name: 'Naval', code: 'SW 6244', hex: '#2f3d4c' },
               { where: 'Trim', name: 'Pure White', code: 'SW 7005', hex: '#edece6' },
               { where: 'Front door', name: 'Daisy', code: 'SW 6912', hex: '#f3c23c' }],
      finish: 'Satin body, semi-gloss trim and door. South wall scraped and spot-primed.',
      photo: { src: 'photo-painter-exterior-ladder.jpg', alt: 'Exterior repaint: a painter rolling the stucco wall', w: 1122, h: 1402 },
      notes: 'Watch the south-facing trim: full sun fades it first.'
    }
  ],
  /* people the member referred, oldest first. A referral moves through: sent > booked > completed (and paid) > credited.
     value = final bill once paid; estimate = quoted value while in progress. miles = distance from the member's home. */
  referrals: [
    { id: 'r1', name: 'Marisol Vega', need: 'Cabinet refresh', area: 'Mueller', miles: 4.6,
      sent: '2026-03-10', booked: '2026-04-01', paid: '2026-05-28', value: 1000, credited: '2026-05-29' },
    { id: 'r2', name: 'Ana Ruiz', need: 'Interior paint', area: 'Zilker', miles: 0.2,
      sent: '2026-06-02', booked: '2026-06-20', paid: '2026-08-21', value: 1800, credited: '2026-08-22' },
    { id: 'r3', name: 'Dan Okafor', need: 'Deck stain and repairs', area: 'Zilker', miles: 0.3,
      sent: '2026-09-15', booked: '2026-10-05', starts: '2026-11-17', estimate: 2400 }
  ],
  /* other completed Cosmic projects near the member that were not their referrals (shown without names) */
  nearby: [
    { label: 'A fence repair on your street', miles: 0.4, completed: '2026-09-12' }
  ],
  /* ?demo=credit: what happens when r3 is completed and paid (the credit-earned celebration) */
  demoCredit: { referral: 'r3', paid: '2026-11-08', value: 2400, credited: '2026-11-09' }
};
