/* diy-content: the DIY content model and seed content (notes/diy/PLAN.md "Content model").
   One file now; one Webflow CMS collection per type later (field names are the future CMS field names).
   The object literal is strict JSON on purpose, so tools can read it without running it.
   - categories: the 9 top-level project categories (icon = brand hub iso icon file name).
   - items: every piece of DIY content, any type: guide | answer | tool | download | pack | product | service.
     Relations are ids only (related.*), both ways where it matters (a product lists the guides it is used in).
     pending: true = its page does not exist yet (links carry data-diy-pending; never href="#").
     image (guides, packs, products): the card photo file in assets/; imageAlt its alt text (products: decorative). Without an image the card shows
     its icon tile. Most are brand-hub photos that look generated: real Cosmic photos replace them (notes/images).
     needs (guides): the tools-and-materials list; the Project Finder's shopping list is built from it.
   - search: synonyms and stop words for js/diy-search.js; intent words that rank types.
   - finder: the Project Finder's questions and the rules that turn answers into a plan (data, not code).
   Every text is draft: true (written by us, not yet approved by Cosmic). No prices, guarantees or crew times
   beyond "usually". Times and coverage are ranges; the can always wins. */
window.COSMIC_DIY = {
  "version": 1,
  "storagePrefix": "cosmic-diy:v1:",
  "typeLabels": {
    "guide": "Guides",
    "answer": "Quick answers",
    "tool": "Tools",
    "download": "Downloads",
    "pack": "Project packs",
    "product": "What we'd use",
    "service": "Cosmic services",
    "category": "Categories"
  },
  "categories": [
    { "id": "painting", "title": "Painting", "summary": "Walls, ceilings, trim and doors, inside and out.", "icon": "iso-02", "order": 1, "url": "diy-category-painting.html", "pending": true },
    { "id": "prep-repair", "title": "Prep & Repair", "summary": "Cleaning, scraping, sanding and patching: the part that decides how long paint lasts.", "icon": "iso-01", "order": 2, "url": "diy-category-prep-repair.html", "pending": true },
    { "id": "cabinets", "title": "Cabinets", "summary": "Kitchen and bath cabinets, refreshed or changed color.", "icon": "iso-21", "order": 3, "url": "diy-category-cabinets.html", "pending": true },
    { "id": "walls-drywall", "title": "Walls & Drywall", "summary": "Holes, dents, cracks and texture.", "icon": "iso-12", "order": 4, "url": "diy-category-walls-drywall.html", "pending": true },
    { "id": "exterior", "title": "Exterior", "summary": "Siding, trim, doors and everything the weather hits.", "icon": "iso-18", "order": 5, "url": "diy-category-exterior.html", "pending": true },
    { "id": "decks-wood", "title": "Decks & Wood", "summary": "Decks, fences and outdoor wood: clean, stain, protect.", "icon": "iso-60", "order": 6, "url": "diy-category-decks-wood.html", "pending": true },
    { "id": "specialty-finishes", "title": "Specialty Finishes", "summary": "Limewash and other finishes beyond flat paint.", "icon": "iso-15", "order": 7, "url": "diy-category-specialty-finishes.html", "pending": true },
    { "id": "maintenance", "title": "Maintenance", "summary": "Small yearly jobs that keep big repairs away.", "icon": "iso-07", "order": 8, "url": "diy-category-maintenance.html", "pending": true },
    { "id": "tools-materials", "title": "Tools & Materials", "summary": "What to buy, what to skip and how to use it.", "icon": "iso-16", "order": 9, "url": "diy-category-tools-materials.html", "pending": true }
  ],
  "items": [
    {
      "id": "paint-a-bedroom", "type": "guide", "draft": true, "featured": 1,
      "image": "photo-painter-interior-wall.jpg", "imageAlt": "A painter rolling white paint onto a living-room wall, drop cloths and a step ladder behind him",
      "title": "How to Paint a Bedroom Properly",
      "summary": "Patch, prep, cut in and roll a room so it looks done by a pro: two coats, clean lines, no lap marks.",
      "url": "diy-guide-paint-a-bedroom.html", "pending": true,
      "category": "painting", "where": "interior",
      "keywords": ["paint a room", "paint bedroom", "paint walls", "repaint", "wall paint", "living room", "ceiling", "cut in", "interior painting", "accent wall"],
      "meta": { "difficulty": "beginner", "time": "1 day", "cost": "±$150", "steps": 8, "tools": 10, "proTime": null },
      "needs": [
        { "id": "wall-paint", "label": "Wall paint, about 2 gallons for a 12 × 12 ft room" },
        { "id": "primer", "label": "Primer, only for patches, stains or a big color change" },
        { "id": "roller", "label": "9 in. roller frame and 3/8 in. cover", "product": "roller" },
        { "id": "tray", "label": "Paint tray and liners" },
        { "id": "angled-brush", "label": "2–2.5 in. angled brush", "product": "angled-brush" },
        { "id": "painters-tape", "label": "Painter's tape", "product": "painters-tape" },
        { "id": "drop-cloth", "label": "Canvas drop cloth", "product": "drop-cloth" },
        { "id": "spackle", "label": "Spackle and a 2 in. putty knife" },
        { "id": "sanding-sponge", "label": "Fine sanding sponge", "product": "sanding-sponge" },
        { "id": "pole", "label": "Extension pole" }
      ],
      "related": { "answers": ["how-many-gallons-of-paint", "what-roller-nap-should-i-use", "why-can-i-see-roller-marks", "do-i-need-primer"], "tools": ["paint-calculator"], "downloads": ["room-painting-checklist", "prep-checklist"], "packs": ["bedroom-paint-pack"], "products": ["roller", "angled-brush", "painters-tape", "drop-cloth", "sanding-sponge"], "services": ["interior-painting"], "guides": ["repair-drywall-holes", "limewash-a-wall"] }
    },
    {
      "id": "paint-kitchen-cabinets", "type": "guide", "draft": true, "featured": 2,
      "image": "photo-kitchen-after.jpg", "imageAlt": "A kitchen with painted white shaker cabinets and brass pulls",
      "title": "How to Paint Kitchen Cabinets Properly",
      "summary": "Degrease, sand, prime and enamel your cabinet doors and boxes for a hard, smooth finish that lasts.",
      "url": "diy-guide-paint-kitchen-cabinets.html",
      "category": "cabinets", "where": "interior",
      "keywords": ["paint cabinets", "cabinet painting", "kitchen cabinets", "cupboards", "bathroom vanity", "cabinet doors", "refinish cabinets", "enamel", "cabinet refresh"],
      "meta": { "difficulty": "intermediate", "time": "2–3 days", "cost": "±$300", "steps": 12, "tools": 8, "proTime": "a crew does it in 2–3 days" },
      "needs": [
        { "id": "degreaser", "label": "Degreaser", "product": "degreaser" },
        { "id": "sanding-sponge", "label": "Sanding sponges, 120 and 220 grit", "product": "sanding-sponge" },
        { "id": "bonding-primer", "label": "Bonding primer", "product": "bonding-primer" },
        { "id": "cabinet-enamel", "label": "Cabinet and trim enamel, about 1 gallon for an average kitchen", "product": "cabinet-enamel" },
        { "id": "angled-brush", "label": "2 in. angled brush", "product": "angled-brush" },
        { "id": "mini-roller", "label": "4 in. foam or fine-nap mini roller" },
        { "id": "painters-tape", "label": "Painter's tape", "product": "painters-tape" },
        { "id": "drop-cloth", "label": "Drop cloth and plastic sheeting", "product": "drop-cloth" },
        { "id": "wood-filler", "label": "Wood filler" },
        { "id": "screwdriver", "label": "Screwdriver or drill" },
        { "id": "labels", "label": "Bags and labels for hinges and hardware" },
        { "id": "tack-cloth", "label": "Tack cloth" },
        { "id": "paintable-caulk", "label": "Paintable caulk" },
        { "id": "safety-kit", "label": "Gloves, glasses and a dust mask" },
        { "id": "step-stool", "label": "Step stool" },
        { "id": "stands", "label": "Painter's pyramids or blocks to rest doors on" }
      ],
      "related": { "answers": ["do-i-need-primer", "can-i-paint-over-glossy-paint", "what-if-i-skip-sanding", "how-long-does-paint-need-to-dry"], "tools": ["paint-calculator"], "downloads": ["cabinet-painting-checklist", "prep-checklist"], "packs": ["cabinet-refresh-pack"], "products": ["degreaser", "sanding-sponge", "bonding-primer", "cabinet-enamel", "angled-brush", "painters-tape", "drop-cloth"], "services": ["cabinet-painting"], "guides": ["paint-a-bedroom"] }
    },
    {
      "id": "fix-peeling-exterior-paint", "type": "guide", "draft": true, "featured": 3,
      "image": "photo-painter-exterior-ladder.jpg", "imageAlt": "A painter on a ladder rolling fresh paint onto an exterior stucco wall",
      "title": "Fix Peeling Exterior Paint",
      "summary": "Find why it's peeling, scrape back to sound paint, prime the bare spots and repaint so it stays put.",
      "url": "diy-guide-fix-peeling-exterior-paint.html", "pending": true,
      "category": "exterior", "where": "exterior",
      "keywords": ["peeling paint", "flaking paint", "paint coming off", "scrape paint", "siding", "exterior paint", "outside paint", "trim", "blistering", "repaint house"],
      "meta": { "difficulty": "intermediate", "time": "1–2 days", "cost": "±$200", "steps": 10, "tools": 11, "proTime": null },
      "needs": [
        { "id": "scraper", "label": "Paint scraper" },
        { "id": "wire-brush", "label": "Wire brush" },
        { "id": "sandpaper", "label": "Sandpaper, 80 and 120 grit" },
        { "id": "exterior-primer", "label": "Exterior bonding primer" },
        { "id": "exterior-paint", "label": "Exterior acrylic paint" },
        { "id": "caulk", "label": "Exterior caulk and a caulk gun" },
        { "id": "angled-brush", "label": "2.5 in. angled brush", "product": "angled-brush" },
        { "id": "drop-cloth", "label": "Drop cloth", "product": "drop-cloth" },
        { "id": "ladder", "label": "Ladder rated for your weight plus tools" },
        { "id": "safety", "label": "Safety glasses and a dust mask" },
        { "id": "lead-test", "label": "Lead test kit, for homes built before 1978" }
      ],
      "related": { "answers": ["why-is-my-paint-peeling", "why-is-my-paint-bubbling", "can-i-paint-exterior-after-rain"], "tools": ["paint-calculator"], "downloads": ["exterior-inspection-sheet", "prep-checklist"], "packs": [], "products": ["angled-brush", "drop-cloth"], "services": ["exterior-painting"], "guides": ["stain-a-deck"] }
    },
    {
      "id": "repair-drywall-holes", "type": "guide", "draft": true, "featured": 4,
      "image": "photo-crew-checking-wall.jpg", "imageAlt": "A crew member running his hand over a wall to check the surface",
      "title": "Repair Drywall Holes",
      "summary": "Fill nail pops, dents and holes up to fist size with spackle, mesh or a patch, then sand it invisible.",
      "url": "diy-guide-repair-drywall-holes.html", "pending": true,
      "category": "walls-drywall", "where": "interior",
      "keywords": ["drywall", "hole in wall", "patch wall", "fix wall", "sheetrock", "spackle", "nail holes", "dent", "crack in wall", "doorknob hole"],
      "meta": { "difficulty": "beginner", "time": "1 day, with drying", "cost": "±$30", "steps": 7, "tools": 7, "proTime": null },
      "needs": [
        { "id": "spackle", "label": "Lightweight spackle, for small holes" },
        { "id": "joint-compound", "label": "Joint compound, for bigger patches" },
        { "id": "mesh-patch", "label": "Self-adhesive mesh patch" },
        { "id": "knives", "label": "Putty knives, 2 in. and 6 in." },
        { "id": "sanding-sponge", "label": "Fine sanding sponge", "product": "sanding-sponge" },
        { "id": "primer", "label": "Primer for the patched spots" },
        { "id": "touch-up", "label": "Touch-up paint that matches the wall" }
      ],
      "related": { "answers": ["do-i-need-primer", "what-if-i-skip-sanding"], "tools": [], "downloads": ["prep-checklist"], "packs": ["bedroom-paint-pack"], "products": ["sanding-sponge"], "services": ["repairs"], "guides": ["paint-a-bedroom"] }
    },
    {
      "id": "stain-a-deck", "type": "guide", "draft": true, "featured": 5,
      "title": "Stain a Deck",
      "summary": "Clean, dry and stain a wood deck so it sheds water and holds its color through Texas sun.",
      "url": "diy-guide-stain-a-deck.html", "pending": true,
      "category": "decks-wood", "where": "exterior",
      "keywords": ["deck stain", "stain deck", "seal deck", "deck", "fence stain", "wood stain", "porch", "pergola", "weathered wood", "gray wood"],
      "meta": { "difficulty": "intermediate", "time": "2–3 days", "cost": "±$250", "steps": 9, "tools": 9, "proTime": null },
      "needs": [
        { "id": "deck-cleaner", "label": "Deck cleaner" },
        { "id": "deck-brush", "label": "Stiff brush on a pole" },
        { "id": "hose", "label": "Garden hose or pump sprayer" },
        { "id": "deck-stain", "label": "Semi-transparent deck stain" },
        { "id": "stain-pad", "label": "Stain pad or brush" },
        { "id": "sandpaper", "label": "Sandpaper, 60–80 grit, for raised grain" },
        { "id": "nail-set", "label": "Hammer and nail set, or a screwdriver" },
        { "id": "painters-tape", "label": "Painter's tape", "product": "painters-tape" },
        { "id": "drop-cloth", "label": "Drop cloth or plastic for plants", "product": "drop-cloth" }
      ],
      "related": { "answers": ["can-i-paint-exterior-after-rain", "how-long-does-paint-need-to-dry"], "tools": [], "downloads": ["exterior-inspection-sheet"], "packs": ["deck-maintenance-pack"], "products": ["painters-tape", "drop-cloth"], "services": ["decks"], "guides": ["fix-peeling-exterior-paint"] }
    },
    {
      "id": "limewash-a-wall", "type": "guide", "draft": true, "featured": 6,
      "image": "photo-hand-on-plaster-wall.jpg", "imageAlt": "A hand resting on a soft, matte plaster wall",
      "title": "Limewash a Wall",
      "summary": "Brush on a soft, cloudy mineral finish over brick, stucco or primed walls. Forgiving and quick.",
      "url": "diy-guide-limewash-a-wall.html", "pending": true,
      "category": "specialty-finishes", "where": "both",
      "keywords": ["limewash", "lime wash", "whitewash", "brick", "paint brick", "stucco", "fireplace", "mineral paint", "texture finish", "plaster look"],
      "meta": { "difficulty": "beginner", "time": "1 day", "cost": "±$120", "steps": 7, "tools": 7, "proTime": null },
      "needs": [
        { "id": "limewash", "label": "Limewash paint" },
        { "id": "mineral-primer", "label": "Mineral primer, over existing paint" },
        { "id": "block-brush", "label": "Wide limewash or block brush" },
        { "id": "spray-bottle", "label": "Spray bottle of water" },
        { "id": "bucket", "label": "Bucket for mixing" },
        { "id": "drop-cloth", "label": "Drop cloth", "product": "drop-cloth" },
        { "id": "ppe", "label": "Gloves and eye protection (lime is caustic)" }
      ],
      "related": { "answers": ["do-i-need-primer"], "tools": [], "downloads": ["prep-checklist"], "packs": [], "products": ["drop-cloth"], "services": ["interior-painting", "exterior-painting"], "guides": ["paint-a-bedroom"] }
    },

    {
      "id": "why-is-my-paint-peeling", "type": "answer", "draft": true, "order": 1, "icon": "iso-57",
      "title": "Why is my paint peeling?",
      "answer": "Almost always moisture or prep. Paint lets go when water gets behind it (leaks, humidity, wet wood), when it went on over dirt, chalk or gloss, or when latex went straight over old oil paint. Fix the cause first, then scrape off everything loose, sand the edges smooth, spot-prime the bare areas and repaint.",
      "url": "diy-question-why-is-my-paint-peeling.html", "pending": true,
      "category": "prep-repair", "where": "both",
      "keywords": ["peeling", "flaking", "paint peeling off", "paint lifting", "chipping"],
      "related": { "guides": ["fix-peeling-exterior-paint"], "answers": ["why-is-my-paint-bubbling", "do-i-need-primer"], "downloads": ["exterior-inspection-sheet"], "services": ["exterior-painting", "repairs"] }
    },
    {
      "id": "do-i-need-primer", "type": "answer", "draft": true, "order": 2, "icon": "iso-03",
      "title": "Do I need primer?",
      "answer": "Usually yes when the surface is new, patched, glossy, stained or bare, on cabinets, and for a big color change. You can often skip it when you repaint a clean, sound, previously painted wall in a similar color.",
      "url": "diy-question-do-i-need-primer.html",
      "category": "painting", "where": "both",
      "keywords": ["primer", "prime", "priming", "paint and primer", "undercoat", "primer before painting"],
      "related": { "guides": ["paint-kitchen-cabinets", "paint-a-bedroom"], "answers": ["can-i-paint-over-glossy-paint", "what-if-i-skip-sanding", "how-long-does-paint-need-to-dry"], "tools": ["paint-calculator"], "products": ["bonding-primer"] }
    },
    {
      "id": "how-many-gallons-of-paint", "type": "answer", "draft": true, "order": 3, "icon": "iso-72",
      "title": "How many gallons of paint do I need?",
      "answer": "Add up the wall area (width × height of each wall), take off about 20 sq ft per door and 15 sq ft per window, then divide by 350–400 sq ft per gallon for each coat. Plan on two coats: a 12 × 12 ft bedroom with 8 ft ceilings usually needs about 2 gallons. Rough or porous surfaces take more; check the coverage on the can.",
      "url": "diy-question-how-many-gallons-of-paint.html", "pending": true,
      "category": "painting", "where": "both",
      "keywords": ["how much paint", "how many gallons", "gallons", "paint coverage", "square feet", "quantity", "how much paint do i need"],
      "related": { "tools": ["paint-calculator"], "guides": ["paint-a-bedroom"] }
    },
    {
      "id": "can-i-paint-over-glossy-paint", "type": "answer", "draft": true, "order": 4, "icon": "iso-42",
      "title": "Can I paint over glossy paint?",
      "answer": "Yes, once it is dull and clean. Wash it with a degreaser, scuff-sand with 180–220 grit until the shine is gone (or use a liquid deglosser), wipe off the dust, then use a bonding primer. If the old paint is oil-based, the bonding primer is not optional: latex straight over oil peels.",
      "url": "diy-question-can-i-paint-over-glossy-paint.html", "pending": true,
      "category": "prep-repair", "where": "both",
      "keywords": ["glossy", "gloss", "semi-gloss", "shiny paint", "oil paint", "oil based", "latex over oil", "enamel"],
      "related": { "guides": ["paint-kitchen-cabinets"], "answers": ["do-i-need-primer", "what-if-i-skip-sanding"], "products": ["bonding-primer", "sanding-sponge", "degreaser"] }
    },
    {
      "id": "what-roller-nap-should-i-use", "type": "answer", "draft": true, "order": 5, "icon": "iso-02",
      "title": "What roller nap should I use?",
      "answer": "Match the nap to the surface: 1/4 in. or foam for very smooth things like doors and cabinets, 3/8 in. for most interior walls and ceilings, 1/2 in. for light texture, and 3/4 in. or more for stucco, brick and block. Too long a nap on a smooth wall leaves an orange-peel texture; too short on a rough one misses the low spots.",
      "url": "diy-question-what-roller-nap-should-i-use.html", "pending": true,
      "category": "tools-materials", "where": "both",
      "keywords": ["roller", "nap", "roller cover", "choose a roller", "which roller", "best roller", "foam roller", "microfiber"],
      "related": { "guides": ["paint-a-bedroom"], "products": ["roller"] }
    },
    {
      "id": "why-can-i-see-roller-marks", "type": "answer", "draft": true, "order": 6, "icon": "iso-17",
      "title": "Why can I see roller marks?",
      "answer": "Usually from rolling over paint that has started to dry, too little paint on the roller, or pressing too hard. Keep a wet edge: work in sections about 3–4 ft wide, load the roller fully, and finish each section with light passes in one direction. Once it is dry, sand the ridges lightly and roll one more coat.",
      "url": "diy-question-why-can-i-see-roller-marks.html", "pending": true,
      "category": "painting", "where": "interior",
      "keywords": ["roller marks", "lap marks", "streaks", "stripes", "uneven paint", "flashing", "lines on wall"],
      "related": { "guides": ["paint-a-bedroom"], "answers": ["what-roller-nap-should-i-use"] }
    },
    {
      "id": "how-long-does-paint-need-to-dry", "type": "answer", "draft": true, "order": 7, "icon": "iso-22",
      "title": "How long does paint need to dry?",
      "answer": "Most latex wall paint is dry to the touch in about an hour and ready for a second coat in 2–4 hours. Oil-based paint takes 6–8 hours to the touch and about 24 hours to recoat. Cool or humid weather stretches every number, and full hardness takes 2–4 weeks, so go easy on fresh cabinets and trim. Check the can for your paint's times.",
      "url": "diy-question-how-long-does-paint-need-to-dry.html", "pending": true,
      "category": "painting", "where": "both",
      "keywords": ["dry time", "drying time", "recoat", "second coat", "cure", "how long", "wait between coats"],
      "related": { "guides": ["paint-kitchen-cabinets", "paint-a-bedroom"] }
    },
    {
      "id": "why-is-my-paint-bubbling", "type": "answer", "draft": true, "order": 8, "icon": "iso-66",
      "title": "Why is my paint bubbling?",
      "answer": "Blisters mean the paint lost its grip as it dried: heat (painting in direct sun or on a hot surface), moisture behind the paint, or a dirty or damp surface. Let it dry, scrape the blisters open, sand smooth, fix any moisture source, prime and repaint. Tiny bubbles while you roll are different: they come from overworking the paint or a cheap cover, and most pop on their own.",
      "url": "diy-question-why-is-my-paint-bubbling.html", "pending": true,
      "category": "prep-repair", "where": "both",
      "keywords": ["bubbling", "bubbles", "blisters", "blistering", "paint bubbles"],
      "related": { "guides": ["fix-peeling-exterior-paint"], "answers": ["why-is-my-paint-peeling"] }
    },
    {
      "id": "can-i-paint-exterior-after-rain", "type": "answer", "draft": true, "order": 9, "icon": "iso-81",
      "title": "Can I paint exterior surfaces after rain?",
      "answer": "Wait until the surface is dry all the way through, not just to the touch: at least a day after rain in sun and wind, longer for wood in shade or humid weather. Then check the forecast: most exterior paints need several dry hours after you finish and a minimum temperature, both printed on the can. In Austin summers, paint the shady side and skip the hottest hours.",
      "url": "diy-question-can-i-paint-exterior-after-rain.html", "pending": true,
      "category": "exterior", "where": "exterior",
      "keywords": ["rain", "wet", "weather", "humidity", "temperature", "forecast", "outside", "exterior"],
      "related": { "guides": ["fix-peeling-exterior-paint", "stain-a-deck"] }
    },
    {
      "id": "what-if-i-skip-sanding", "type": "answer", "draft": true, "order": 10, "icon": "iso-74",
      "title": "What happens if I skip sanding?",
      "answer": "On a flat, clean, previously painted wall you can often skip it. On gloss, cabinets, trim and anything with bumps, drips or old brush marks you cannot: new paint will not grip shiny surfaces, and it shows every flaw underneath. A quick scuff with a fine sanding sponge takes minutes and decides whether the job lasts.",
      "url": "diy-question-what-if-i-skip-sanding.html", "pending": true,
      "category": "prep-repair", "where": "both",
      "keywords": ["sanding", "sand", "skip sanding", "do i need to sand", "scuff", "deglosser", "no sanding"],
      "related": { "guides": ["paint-kitchen-cabinets"], "answers": ["can-i-paint-over-glossy-paint"], "products": ["sanding-sponge"] }
    },

    {
      "id": "paint-calculator", "type": "tool", "draft": true, "icon": "iso-72",
      "title": "Paint Calculator",
      "summary": "Measure your room and get the gallons for two coats, with doors and windows taken off.",
      "url": "diy-tool-paint-calculator.html",
      "category": "painting", "where": "both",
      "keywords": ["calculator", "calculate", "how much paint", "how many gallons", "gallons", "square feet", "measure", "paint estimate", "coverage"],
      "related": { "guides": ["paint-a-bedroom", "paint-kitchen-cabinets"], "answers": ["how-many-gallons-of-paint", "do-i-need-primer", "what-roller-nap-should-i-use"], "packs": ["bedroom-paint-pack"] }
    },

    {
      "id": "room-painting-checklist", "type": "download", "draft": true, "icon": "iso-04",
      "title": "Room Painting Checklist",
      "summary": "From clearing the room to the last touch-up, on one printable page.",
      "url": "diy-resource-room-painting-checklist.html", "pending": true, "format": "Printable · 1 page",
      "category": "painting", "where": "interior",
      "keywords": ["checklist", "room checklist", "painting checklist", "printable", "list"],
      "related": { "guides": ["paint-a-bedroom"], "packs": ["bedroom-paint-pack"] }
    },
    {
      "id": "prep-checklist", "type": "download", "draft": true, "icon": "iso-12",
      "title": "Surface Prep Checklist",
      "summary": "Clean, fill, sand, prime: what each surface needs before paint.",
      "url": "diy-resource-prep-checklist.html", "pending": true, "format": "Printable · 1 page",
      "category": "prep-repair", "where": "both",
      "keywords": ["prep", "preparation", "surface prep", "prep checklist", "before painting", "printable"],
      "related": { "guides": ["paint-a-bedroom", "paint-kitchen-cabinets", "repair-drywall-holes"], "packs": ["bedroom-paint-pack", "cabinet-refresh-pack"] }
    },
    {
      "id": "cabinet-painting-checklist", "type": "download", "draft": true, "icon": "iso-21",
      "title": "Cabinet Painting Checklist",
      "summary": "Label, remove, degrease, sand, prime, paint, rehang, with dry times between.",
      "url": "diy-resource-cabinet-painting-checklist.html", "pending": true, "format": "Printable · 2 pages",
      "category": "cabinets", "where": "interior",
      "keywords": ["cabinet checklist", "cabinets", "checklist", "printable", "kitchen"],
      "related": { "guides": ["paint-kitchen-cabinets"], "packs": ["cabinet-refresh-pack"] }
    },
    {
      "id": "exterior-inspection-sheet", "type": "download", "draft": true, "icon": "iso-18",
      "title": "Exterior Inspection Sheet",
      "summary": "Walk around the house once a year and note peeling, cracks, gaps and soft wood before they grow.",
      "url": "diy-resource-exterior-inspection-sheet.html", "pending": true, "format": "Printable · 1 page",
      "category": "maintenance", "where": "exterior",
      "keywords": ["inspection", "exterior checklist", "maintenance", "walk around", "yearly", "printable", "sheet"],
      "related": { "guides": ["fix-peeling-exterior-paint", "stain-a-deck"], "packs": ["deck-maintenance-pack"] }
    },

    {
      "id": "bedroom-paint-pack", "type": "pack", "draft": true, "icon": "iso-30",
      "image": "photo-tools-rollers.jpg", "imageAlt": "Paint rollers, spare roller covers and a roller frame laid out",
      "title": "The Bedroom Paint Pack",
      "summary": "Everything for one room, start to finish: measure, buy, prep, paint and clean up.",
      "url": "diy-pack-bedroom-paint-pack.html", "pending": true,
      "category": "painting", "where": "interior",
      "keywords": ["bedroom", "room pack", "paint a room", "bedroom paint", "kit", "project kit"],
      "meta": { "difficulty": "beginner", "time": "1 day", "cost": "±$150" },
      "includes": ["Step-by-step guide", "Paint calculator", "Shopping list", "Prep checklist", "Room painting checklist", "Common mistakes"],
      "related": { "guides": ["paint-a-bedroom", "repair-drywall-holes"], "tools": ["paint-calculator"], "downloads": ["room-painting-checklist", "prep-checklist"], "answers": ["how-many-gallons-of-paint", "what-roller-nap-should-i-use", "why-can-i-see-roller-marks"], "products": ["roller", "angled-brush", "painters-tape", "drop-cloth", "sanding-sponge"] }
    },
    {
      "id": "cabinet-refresh-pack", "type": "pack", "draft": true, "icon": "iso-21",
      "image": "photo-tools-fine-finish.jpg", "imageAlt": "A fine-finish roller, spare covers and an angled brush laid out",
      "title": "The Cabinet Refresh Pack",
      "summary": "The guide, the dry-time schedule and the exact list for a cabinet job that does not chip.",
      "url": "diy-pack-cabinet-refresh-pack.html", "pending": true,
      "category": "cabinets", "where": "interior",
      "keywords": ["cabinet", "cabinets", "cupboards", "kitchen refresh", "cabinet kit", "project kit"],
      "meta": { "difficulty": "intermediate", "time": "2–3 days", "cost": "±$300" },
      "includes": ["Step-by-step guide", "Cabinet painting checklist", "Shopping list", "Prep checklist", "Dry and recoat schedule", "Common mistakes"],
      "related": { "guides": ["paint-kitchen-cabinets"], "downloads": ["cabinet-painting-checklist", "prep-checklist"], "answers": ["do-i-need-primer", "can-i-paint-over-glossy-paint", "what-if-i-skip-sanding"], "products": ["degreaser", "sanding-sponge", "bonding-primer", "cabinet-enamel", "angled-brush", "painters-tape"] }
    },
    {
      "id": "deck-maintenance-pack", "type": "pack", "draft": true, "icon": "iso-60",
      "title": "The Deck Maintenance Pack",
      "summary": "Clean, check and re-stain your deck on a schedule that suits Austin sun and storms.",
      "url": "diy-pack-deck-maintenance-pack.html", "pending": true,
      "category": "decks-wood", "where": "exterior",
      "keywords": ["deck", "deck maintenance", "deck care", "fence", "stain", "kit", "project kit"],
      "meta": { "difficulty": "intermediate", "time": "2–3 days", "cost": "±$250" },
      "includes": ["Step-by-step guide", "Exterior inspection sheet", "Shopping list", "Weather window tips", "Yearly schedule"],
      "related": { "guides": ["stain-a-deck"], "downloads": ["exterior-inspection-sheet"], "answers": ["can-i-paint-exterior-after-rain"], "products": ["painters-tape", "drop-cloth"] }
    },

    {
      "id": "roller", "type": "product", "draft": true, "image": "diy-roller.jpg", "icon": "iso-02",
      "title": "9 in. roller frame and 3/8 in. cover",
      "summary": "A sturdy frame that does not flex, and a 3/8 in. woven or microfiber cover for most walls and ceilings.",
      "url": "#shop", "shop": "roller",
      "category": "tools-materials", "where": "both",
      "keywords": ["roller", "roller frame", "roller cover", "nap", "paint roller"],
      "related": { "guides": ["paint-a-bedroom"], "answers": ["what-roller-nap-should-i-use"], "packs": ["bedroom-paint-pack"] }
    },
    {
      "id": "angled-brush", "type": "product", "draft": true, "icon": "iso-04",
      "title": "2–2.5 in. angled brush",
      "summary": "Cuts a straight line along ceilings, corners and trim. Nylon or polyester bristles for latex paint.",
      "url": "#shop", "shop": "angled-brush",
      "category": "tools-materials", "where": "both",
      "keywords": ["brush", "angled brush", "sash brush", "cut in", "paintbrush"],
      "related": { "guides": ["paint-a-bedroom", "paint-kitchen-cabinets", "fix-peeling-exterior-paint"], "packs": ["bedroom-paint-pack", "cabinet-refresh-pack"] }
    },
    {
      "id": "painters-tape", "type": "product", "draft": true, "image": "diy-tape.jpg", "icon": "iso-05",
      "title": "Painter's tape",
      "summary": "Medium adhesion for trim, glass and hardware. Pull it back at an angle once the paint is dry to the touch.",
      "url": "#shop", "shop": "painters-tape",
      "category": "tools-materials", "where": "both",
      "keywords": ["tape", "painters tape", "masking tape", "blue tape", "clean lines"],
      "related": { "guides": ["paint-a-bedroom", "paint-kitchen-cabinets", "stain-a-deck"], "packs": ["bedroom-paint-pack", "cabinet-refresh-pack", "deck-maintenance-pack"] }
    },
    {
      "id": "bonding-primer", "type": "product", "draft": true, "icon": "iso-03",
      "title": "Bonding primer",
      "summary": "Grips gloss, laminate and old oil paint so the topcoat does not peel.",
      "url": "#shop", "shop": "bonding-primer",
      "category": "tools-materials", "where": "both",
      "keywords": ["primer", "bonding primer", "adhesion primer", "stain blocking", "undercoat"],
      "related": { "guides": ["paint-kitchen-cabinets"], "answers": ["do-i-need-primer", "can-i-paint-over-glossy-paint"], "packs": ["cabinet-refresh-pack"] }
    },
    {
      "id": "cabinet-enamel", "type": "product", "draft": true, "icon": "iso-72",
      "title": "Cabinet and trim enamel",
      "summary": "A waterborne enamel that levels out smooth and cures hard enough for daily hands.",
      "url": "#shop", "shop": "cabinet-enamel",
      "category": "tools-materials", "where": "interior",
      "keywords": ["cabinet paint", "enamel", "trim paint", "door paint", "hard finish"],
      "related": { "guides": ["paint-kitchen-cabinets"], "packs": ["cabinet-refresh-pack"] }
    },
    {
      "id": "sanding-sponge", "type": "product", "draft": true, "icon": "iso-74",
      "title": "Sanding sponges, 120 and 220 grit",
      "summary": "They bend around door profiles and trim, and they do not clog as fast as paper.",
      "url": "#shop", "shop": "sanding-sponge",
      "category": "tools-materials", "where": "both",
      "keywords": ["sandpaper", "sanding", "sanding sponge", "sanding block", "grit"],
      "related": { "guides": ["paint-kitchen-cabinets", "paint-a-bedroom", "repair-drywall-holes"], "answers": ["what-if-i-skip-sanding"], "packs": ["cabinet-refresh-pack", "bedroom-paint-pack"] }
    },
    {
      "id": "drop-cloth", "type": "product", "draft": true, "icon": "iso-08",
      "title": "Canvas drop cloth",
      "summary": "Stays put underfoot and soaks up drips instead of spreading them like plastic does.",
      "url": "#shop", "shop": "drop-cloth",
      "category": "tools-materials", "where": "both",
      "keywords": ["drop cloth", "dropcloth", "floor protection", "canvas", "cover floor"],
      "related": { "guides": ["paint-a-bedroom", "paint-kitchen-cabinets", "fix-peeling-exterior-paint", "stain-a-deck", "limewash-a-wall"], "packs": ["bedroom-paint-pack"] }
    },
    {
      "id": "degreaser", "type": "product", "draft": true, "icon": "iso-51",
      "title": "Degreaser",
      "summary": "Kitchen grease is invisible and paint will not stick to it. Rinse with clean water after.",
      "url": "#shop", "shop": "degreaser",
      "category": "tools-materials", "where": "interior",
      "keywords": ["degreaser", "cleaner", "grease", "clean cabinets", "tsp"],
      "related": { "guides": ["paint-kitchen-cabinets"], "answers": ["can-i-paint-over-glossy-paint"], "packs": ["cabinet-refresh-pack"] }
    },

    {
      "id": "interior-painting", "type": "service", "draft": true, "estimateService": "painting",
      "title": "Interior painting",
      "summary": "Rather have the Cosmic crew paint it? Get a clear estimate.",
      "url": "#estimate", "category": "painting", "where": "interior",
      "keywords": ["hire painter", "painter", "painting company", "professional", "pro", "contractor", "interior painting", "estimate", "quote"],
      "related": { "guides": ["paint-a-bedroom"] }
    },
    {
      "id": "cabinet-painting", "type": "service", "draft": true, "estimateService": "painting",
      "title": "Cabinet painting",
      "summary": "We can take the cabinets from here. Get a clear estimate.",
      "url": "#estimate", "category": "cabinets", "where": "interior",
      "keywords": ["cabinet painting", "cabinet painter", "hire", "professional", "pro", "quote", "estimate"],
      "related": { "guides": ["paint-kitchen-cabinets"] }
    },
    {
      "id": "exterior-painting", "type": "service", "draft": true, "estimateService": "painting",
      "title": "Exterior painting",
      "summary": "Ladders, heights and a lot of surface: we can handle it. Get a clear estimate.",
      "url": "#estimate", "category": "exterior", "where": "exterior",
      "keywords": ["exterior painting", "house painter", "paint house", "hire", "professional", "pro", "quote", "estimate"],
      "related": { "guides": ["fix-peeling-exterior-paint"] }
    },
    {
      "id": "repairs", "type": "service", "draft": true, "estimateService": "repairs",
      "title": "Repairs",
      "summary": "Drywall, rot and the small fixes that pile up. Get a clear estimate.",
      "url": "#estimate", "category": "prep-repair", "where": "both",
      "keywords": ["repair", "handyman", "drywall repair", "fix", "hire", "professional", "pro", "quote", "estimate"],
      "related": { "guides": ["repair-drywall-holes"] }
    },
    {
      "id": "decks", "type": "service", "draft": true, "estimateService": "fences",
      "title": "Fences and decks",
      "summary": "Cleaning, repairs and staining by the crew. Get a clear estimate.",
      "url": "#estimate", "category": "decks-wood", "where": "exterior",
      "keywords": ["deck", "fence", "deck staining", "hire", "professional", "pro", "quote", "estimate"],
      "related": { "guides": ["stain-a-deck"] }
    }
  ],

  "search": {
    "stopwords": ["a", "an", "the", "my", "i", "to", "of", "for", "on", "in", "it", "is", "are", "and", "or", "with", "me", "we", "you", "your", "do", "does", "can", "should", "how", "what", "why", "when", "which", "will", "need", "best", "way", "get"],
    "synonyms": {
      "cupboard": "cabinet", "cupboards": "cabinets", "vanity": "cabinets", "flaking": "peeling", "chipping": "peeling",
      "blister": "bubbling", "blisters": "bubbling", "bubbles": "bubbling", "sheetrock": "drywall", "gyprock": "drywall",
      "gallon": "gallons", "lime": "limewash", "whitewash": "limewash", "patch": "repair", "fence": "deck",
      "nap": "roller", "streaks": "roller marks", "undercoat": "primer", "outside": "exterior", "inside": "interior"
    },
    "intents": {
      "question": { "words": ["why", "how", "what", "which", "when", "can", "do", "does", "should", "is", "are", "will"], "boost": { "answer": 1.8, "tool": 1.2 } },
      "project": { "words": ["paint", "painting", "fix", "repair", "stain", "limewash", "refinish", "patch", "seal", "strip", "clean", "prime", "caulk", "redo", "how to"], "boost": { "guide": 1.7, "pack": 1.35 } },
      "problem": { "words": ["peeling", "bubbling", "blistering", "flaking", "cracking", "cracked", "marks", "streaks", "stuck", "sticky", "mildew", "yellowing", "chipping", "wont", "dry"], "boost": { "answer": 1.8 } },
      "measure": { "words": ["calculator", "calculate", "how much", "how many", "gallons", "square feet", "measure", "coverage"], "boost": { "tool": 2.2, "answer": 1.2 } },
      "print": { "words": ["checklist", "list", "printable", "worksheet", "sheet", "pdf", "download", "print"], "boost": { "download": 2.2 } },
      "hire": { "words": ["hire", "pro", "professional", "contractor", "company", "quote", "near me", "someone"], "boost": { "service": 2.5 } },
      "buy": { "words": ["buy", "best", "which", "brand", "product", "tool", "tools", "supplies"], "boost": { "product": 1.6 } }
    },
    "popular": ["paint a bedroom", "paint kitchen cabinets", "fix peeling paint", "how much paint do I need", "do I need primer", "stain a deck"]
  },

  "finder": {
    "questions": [
      { "id": "where", "title": "Inside or outside?", "lede": "Pick one to start.", "options": [
        { "value": "interior", "label": "Inside", "meta": "Rooms, kitchens, baths", "icon": "iso-30" },
        { "value": "exterior", "label": "Outside", "meta": "House, deck, fence", "icon": "iso-18" }
      ] },
      { "id": "surface", "title": "Which surface?", "lede": "Pick the main one.", "options": [
        { "value": "wall", "label": "Walls", "where": "interior", "icon": "iso-02" },
        { "value": "ceiling", "label": "Ceiling", "where": "interior", "icon": "iso-06" },
        { "value": "cabinets", "label": "Cabinets", "where": "interior", "icon": "iso-21" },
        { "value": "trim", "label": "Trim", "where": "both", "icon": "iso-04" },
        { "value": "doors", "label": "Doors", "where": "both", "icon": "iso-23" },
        { "value": "drywall", "label": "Drywall", "where": "interior", "icon": "iso-12" },
        { "value": "furniture", "label": "Furniture", "where": "interior", "icon": "iso-37" },
        { "value": "siding", "label": "Siding", "where": "exterior", "icon": "iso-58" },
        { "value": "brick", "label": "Brick", "where": "exterior", "icon": "iso-10" },
        { "value": "stucco", "label": "Stucco", "where": "exterior", "icon": "iso-19" },
        { "value": "deck", "label": "Deck", "where": "exterior", "icon": "iso-69" },
        { "value": "fence", "label": "Fence", "where": "exterior", "icon": "iso-60" },
        { "value": "other", "label": "Something else", "where": "both", "icon": "iso-80" }
      ] },
      { "id": "condition", "title": "What shape is it in?", "lede": "Pick the closest.", "options": [
        { "value": "new", "label": "New or unfinished", "meta": "Bare wood, fresh drywall" },
        { "value": "painted", "label": "Previously painted", "meta": "Sound, just tired" },
        { "value": "dirty", "label": "Dirty", "meta": "Grease, grime, mildew" },
        { "value": "damaged", "label": "Damaged", "meta": "Holes, dents, gouges" },
        { "value": "cracked", "label": "Cracked", "meta": "Hairline or wider" },
        { "value": "peeling", "label": "Peeling", "meta": "Flaking or lifting" },
        { "value": "stained", "label": "Stained", "meta": "Water, smoke, tannin" },
        { "value": "glossy", "label": "Glossy", "meta": "Shiny or oil paint" },
        { "value": "weathered", "label": "Weathered", "meta": "Faded, chalky, gray" },
        { "value": "not-sure", "label": "Not sure", "meta": "We'll add a quick test" }
      ] },
      { "id": "goal", "title": "What do you want to end up with?", "lede": "Pick the main goal.", "options": [
        { "value": "repaint", "label": "Repaint", "meta": "Same color, fresh coat" },
        { "value": "change-color", "label": "Change color", "meta": "New color" },
        { "value": "repair", "label": "Repair", "meta": "Fix the damage" },
        { "value": "refresh", "label": "Refresh", "meta": "Clean up, touch up" },
        { "value": "protect", "label": "Protect", "meta": "Seal it from weather" },
        { "value": "strip", "label": "Strip or refinish", "meta": "Back to bare" },
        { "value": "maintenance", "label": "Maintenance", "meta": "Keep it in shape" },
        { "value": "transform", "label": "Full transformation", "meta": "Make it new" }
      ] }
    ],
    "rules": [
      { "when": { "where": ["interior"], "surface": ["drywall"] }, "guide": "repair-drywall-holes" },
      { "when": { "where": ["interior"], "surface": ["wall", "ceiling"], "condition": ["damaged", "cracked"], "goal": ["repair"] }, "guide": "repair-drywall-holes" },
      { "when": { "where": ["interior"], "surface": ["cabinets", "furniture", "doors"] }, "guide": "paint-kitchen-cabinets" },
      { "when": { "where": ["interior"], "surface": ["wall", "ceiling", "trim"] }, "guide": "paint-a-bedroom" },
      { "when": { "where": ["exterior"], "surface": ["deck", "fence"] }, "guide": "stain-a-deck" },
      { "when": { "where": ["exterior"], "surface": ["brick", "stucco"], "goal": ["change-color", "refresh", "transform"] }, "guide": "limewash-a-wall" },
      { "when": { "where": ["exterior"], "surface": ["siding", "trim", "doors", "brick", "stucco"], "condition": ["peeling", "weathered", "damaged", "cracked", "not-sure"] }, "guide": "fix-peeling-exterior-paint" },
      { "when": { "where": ["exterior"], "surface": ["siding", "trim", "doors", "brick", "stucco"] }, "guide": "fix-peeling-exterior-paint", "closest": true },
      { "when": { "where": ["interior"] }, "guide": "paint-a-bedroom", "closest": true },
      { "when": { "where": ["exterior"] }, "guide": "fix-peeling-exterior-paint", "closest": true }
    ],
    "conditionNotes": {
      "new": { "note": "Bare drywall and bare wood need a coat of primer before paint.", "answers": ["do-i-need-primer"] },
      "dirty": { "note": "Wash it with a degreaser or mild detergent, rinse, and let it dry fully. Paint does not stick to grime." },
      "damaged": { "note": "Fill and sand the damage before any paint goes on.", "guides": ["repair-drywall-holes"], "whereOnly": "interior" },
      "cracked": { "note": "Fill hairline cracks with flexible caulk or compound; a crack that keeps coming back can mean movement or moisture." },
      "peeling": { "note": "Scrape back to paint that is holding firm and feather the edges with sandpaper before you prime.", "answers": ["why-is-my-paint-peeling"], "safety": true },
      "stained": { "note": "Seal stains with a stain-blocking primer first, or they bleed through every coat.", "answers": ["do-i-need-primer"] },
      "glossy": { "note": "Scuff-sand until the shine is gone and use a bonding primer, or new paint can peel off in sheets.", "answers": ["can-i-paint-over-glossy-paint", "what-if-i-skip-sanding"] },
      "weathered": { "note": "Wash, let it dry right through, and brush off chalky or gray fibers before you coat it.", "answers": ["can-i-paint-exterior-after-rain"] },
      "not-sure": { "note": "Do the tape test: press painter's tape on firmly and rip it off. If paint comes away with it, scrape and prime before painting.", "answers": ["why-is-my-paint-peeling"] }
    },
    "goalNotes": {
      "change-color": { "note": "Going much lighter or darker? A tinted primer can save you a coat.", "answers": ["how-many-gallons-of-paint"] },
      "strip": { "note": "Stripping is the slowest part of any finish job. Work in a ventilated space and follow the stripper's label.", "safety": true },
      "protect": { "note": "Pick a finish made for the exposure: exterior-rated, and for decks a stain made for foot traffic." }
    },
    "safety": "Homes built before 1978 may have lead paint. Test before you scrape or sand, and follow EPA lead-safe practices if it is positive.",
    "escalate": [
      { "when": { "where": ["exterior"], "surface": ["siding", "brick", "stucco"] }, "reason": "Exterior walls usually mean ladders and working at height." },
      { "when": { "goal": ["transform"] }, "reason": "A full transformation is a lot of surface and a lot of weekends." },
      { "when": { "goal": ["strip"] }, "reason": "Stripping back to bare is slow, messy work." },
      { "when": { "surface": ["cabinets"] }, "reason": "Cabinets keep the kitchen out of action for days." },
      { "when": { "where": ["exterior"], "condition": ["damaged", "cracked"] }, "reason": "Damage outside can hide rot or a moisture problem." }
    ],
    "offer": { "title": "Getting bigger than expected?", "body": "Some projects stop being worth the weekend. We can take it from here.", "cta": "Get an estimate" }
  }
};
