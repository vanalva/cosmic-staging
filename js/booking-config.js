/* booking-config: availability for the walkthrough booking (js/booking.js, components/booking.html).
   DEMO DATA. Every value below is a placeholder until Cosmic confirms it; nothing here comes from a real calendar.
   Load this file before booking.js. Times are Austin wall-clock time (America/Chicago), 24-hour "HH:MM".

   Replacing the demo with a real source (see notes/components/booking.md, "Integration points"):
   - set demo: false and delete demoPattern;
   - give `source` a function that returns a Promise of either
       { busy:  [{ start: ISO, end: ISO }, ...] }   busy intervals (Google Calendar freeBusy returns exactly this), or
       { slots: [{ start: ISO, end: ISO }, ...] }   free slots (Cal.com /v2/slots returns free start times);
     it is called once per open with { from: ISO, to: ISO, timezone } covering the days shown;
   - optionally give `book` a function(slot, answers) returning a Promise, called on submit to hold the slot
     (Cal.com POST /v2/bookings, or your own endpoint that inserts the Google Calendar event). Without it the slot
     only travels with the form (visit_start / visit_end / visit_when / visit_timezone). */
window.COSMIC_BOOKING = {
  demo: true,                         // DEMO: invented availability; the UI says so

  timezone: 'America/Chicago',        // every time on the site is Austin time
  zoneLabel: 'Austin time (CT)',      // shown next to the times
  durationMin: 45,                    // DEMO placeholder: walkthrough length, to confirm with Cosmic
  slotStepMin: 60,                    // a visit can start every hour (45 min + 15 min to get to the next one)
  hours: { start: '09:00', end: '17:00' },   // DEMO: first start / the last visit ends by this time
  workdays: [1, 2, 3, 4, 5],          // DEMO: Monday to Friday (0 = Sunday)
  leadHours: 24,                      // DEMO: earliest booking is 24 hours from now
  daysAhead: 14,                      // working days shown in the strip

  title: 'Cosmic walkthrough',        // calendar event title
  details: 'Walkthrough visit with Cosmic: we look at the place, measure and talk through the work before we price it.',

  /* DEMO: fixed busy blocks on real dates, Austin time. A real source replaces this. */
  busy: {
    // '2026-11-24': [['09:00', '12:00']]
  },

  /* DEMO: busy blocks by working day, counted from today (0 = first working day shown), repeating.
     'full' = no free time that day (the day shows disabled). Relative so the demo never runs out of dates. */
  demoPattern: [
    [],
    [['09:00', '12:00']],
    'full',
    [['13:00', '15:00']],
    [['10:00', '11:00'], ['15:00', '17:00']],
    [['09:00', '10:00']],
    'full',
    [['11:00', '14:00']],
    [],
    [['09:00', '11:00'], ['14:00', '16:00']],
    'full',
    [['12:00', '13:00']],
    [['09:00', '13:00']],
    [['15:00', '17:00']]
  ],

  source: null,                       // function ({ from, to, timezone }) -> Promise<{ busy } | { slots }>
  book: null                          // function (slot, answers) -> Promise
};
