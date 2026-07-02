# Next Show

Given the GH Issue https://github.com/samcarrington/punters-club/issues/3 which adds a requirement to include a 'next show' module, we need to evolve the scope and architecture for it.

## Context

Given that the show schedule is edited, managed, and published on a separate platform on which we have not access to edit source code;

We need a reliable way to poll or otherwise publish shows in tandem to our page.

The show is not a repeated calendar item on a schedule, it's added ad-hoc. Usual cadence is monthly

Source calendar on the Radio Station site. It's a wordpress site and event listings can possibly be gathered using a 'tribe_events' post type: i.e. https://www.radiowaters.co.uk/wp-json/wp/v2/tribe_events however that API response doesn't seem to include all the shows displayed in the calendar landing page; https://www.radiowaters.co.uk/shows/

There's an edge case when we don't actually set up our own listing, but appear as a guest on other shows - so we may need to be able to specify shows on which we appear as guests without them having "Punter's Club" in the name. i.e. the next show https://www.radiowaters.co.uk/show/saturday-night-in-with/2026-07-04/

## Aim

We need to evolve an efficient way to populate the 'next show' card with accurate data. We must not abuse the radiowaters.co.uk API but need to find a good way to reliably extract show data. It should be scripted, and run on build or as a github workflow. But there is a likelihood it will need to be interactive and subject to human approval given the 'Night In With' edge case.