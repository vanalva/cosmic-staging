/* club-config: the Good Neighbor Club's rules and economics, in ONE place, so no page hard-codes the business model.
   Every number here is a DRAFT proposed by the lead (2026-11-10) for Juan / Cosmic to confirm; pages read it and must
   render whatever it says (a different rate, cap or threshold changes copy and maths without touching markup).
   Owned by the lead; page agents read it, never edit it. */
window.COSMIC_CLUB = {
  version: 1,
  draft: true,
  name: 'The Cosmic Good Neighbor Club',
  promise: 'Good work should keep working for you.',
  membership: {
    activation: 'automatic',          // every client with a completed, paid Cosmic project is a member
    activationTrigger: 'first completed and paid project',
    fee: 0
  },
  referral: {
    creditPer: 100, per: 1000,        // $100 Cosmic Credit per $1,000 of completed, paid referred work
    creditMode: 'proportional',       // 'proportional': $1,800 earns $180 · 'per-full': only full $1,000s count ($100)
    capPerProject: 500,               // most credit one referred project can earn
    minProjectValue: 500,             // referred projects below this earn nothing
    paidWhen: 'the referred project is completed and paid',
    referredGets: 'priority scheduling for their first project',   // what the new client gets (draft)
    shortLine: 'Refer a neighbor. They get Cosmic. You get Cosmic Credit.'
  },
  credit: {
    currency: 'USD',
    usableOn: 'any future Cosmic project',
    maxShareOfProject: 0.5,           // credit can cover up to half of a project
    expiresMonths: 24,
    cashValue: false
  },
  returning: {
    perks: ['priority scheduling', 'complimentary annual check-in', 'touch-up visit within 12 months of a project',
            'occasional member-only offers']
  },
  checkIn: { complimentary: true, everyMonths: 12, what: 'a walk-through of past work and anything due for care' },
  neighborhood: {
    radiusMiles: 0.5, windowMonths: 12,
    unlockAt: 3,                      // completed Cosmic projects within the radius and window unlock a perk
    perks: ['extra $100 Cosmic Credit for every member nearby', 'a free small upgrade on your next project',
            'a maintenance visit', 'a contribution to a neighborhood cause', 'a block event on Cosmic']
  },
  termsUrl: 'club-terms.html'         // phase 2 page
};
