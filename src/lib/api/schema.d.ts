/**
 * Generated from openapi.json by `npm run contract:sync` (openapi-typescript).
 * Do not edit: CI fails if this file differs from what openapi.json generates.
 */

export interface paths {
    "/v1/areas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Areas, newest first
         * @description `q` finds names starting with it, ignoring case. Deleted areas are not listed.
         */
        get: operations["areas_list"];
        put?: never;
        /**
         * Add an area
         * @description Requires `Idempotency-Key`. 409 AREA_NAME_TAKEN: a live area has this name, ignoring
         *     case. Open route requests that typed this name, ignoring case, now name the area.
         */
        post: operations["areas_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/areas/{area_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One area
         * @description A live area by ID. 404 NOT_FOUND for one that never existed or was deleted.
         */
        get: operations["areas_get"];
        put?: never;
        post?: never;
        /**
         * Delete an area (admins only)
         * @description Soft delete: the area disappears from lists and pickers, and its name can be used
         *     again; history keeps it. 409 AREA_IN_USE while a corridor uses it.
         */
        delete: operations["areas_delete"];
        options?: never;
        head?: never;
        /**
         * Rename an area
         * @description Everything that refers to the area shows the new name. Renaming to the current name
         *     changes nothing on the area. Either way, open route requests that typed its name,
         *     ignoring case, now name the area.
         */
        patch: operations["areas_update"];
        trace?: never;
    };
    "/v1/audit-log": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The audit log, newest first
         * @description Every recorded change, filtered by entity or actor. Names, emails and other personal
         *     values never appear: the entries show only that they changed.
         */
        get: operations["audit_log_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/companies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Companies, newest first
         * @description `q` finds names starting with it, ignoring case; `is_active` filters. Deleted
         *     companies are not listed.
         */
        get: operations["companies_list"];
        put?: never;
        /**
         * Add a company
         * @description Requires `Idempotency-Key`. 409 COMPANY_NAME_TAKEN: a live company has this name,
         *     ignoring case. The contact phone is stored E.164.
         */
        post: operations["companies_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/companies/{company_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One company
         * @description A live company by ID, active or not. 404 NOT_FOUND for one that never existed or was
         *     deleted.
         */
        get: operations["companies_get"];
        put?: never;
        post?: never;
        /**
         * Delete a company (admins only)
         * @description Soft delete: hidden from lists, its name free again; history keeps it. 409
         *     COMPANY_IN_USE while it has a live route.
         */
        delete: operations["companies_delete"];
        options?: never;
        head?: never;
        /**
         * Change a company, or deactivate it
         * @description Leave out what stays. Empty notes clear them. Setting what is there changes nothing.
         *     409 COMPANY_IN_USE: deactivating while one of its routes is active or paused.
         */
        patch: operations["companies_update"];
        trace?: never;
    };
    "/v1/corridors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Corridors, newest first
         * @description With both areas' names. Deleted corridors are not listed.
         */
        get: operations["corridors_list"];
        put?: never;
        /**
         * Add a corridor
         * @description Requires `Idempotency-Key`. 409 CORRIDOR_EXISTS: a live corridor has this pair (the
         *     way back is another corridor). An area that doesn't exist is a 422 on its field.
         */
        post: operations["corridors_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/corridors/{corridor_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One corridor
         * @description A live corridor by ID, with its two areas. 404 NOT_FOUND for one that never existed or
         *     was deleted.
         */
        get: operations["corridors_get"];
        put?: never;
        post?: never;
        /**
         * Delete a corridor (admins only)
         * @description Soft delete: hidden from lists, its pair free again; history keeps it. 409
         *     CORRIDOR_IN_USE while a live route runs on it.
         */
        delete: operations["corridors_delete"];
        options?: never;
        head?: never;
        /**
         * Change a corridor's areas
         * @description Leave an end out to keep it. The result must be two different areas. 409
         *     CORRIDOR_IN_USE: a live route runs on it (move the routes first).
         */
        patch: operations["corridors_update"];
        trace?: never;
    };
    "/v1/drivers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Drivers, newest first
         * @description `q` finds names, or plates (any case or spacing), starting with it; `is_active`
         *     filters. Deleted drivers are not listed.
         */
        get: operations["drivers_list"];
        put?: never;
        /**
         * Add a driver
         * @description Requires `Idempotency-Key`. 409 DRIVER_EXISTS: a live driver has this phone; 409
         *     PLATE_TAKEN: one has this plate.
         */
        post: operations["drivers_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/drivers/{driver_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One driver
         * @description A live driver by ID, active or not; their phone in full. 404 NOT_FOUND for one that
         *     never existed or was deleted.
         */
        get: operations["drivers_get"];
        put?: never;
        post?: never;
        /**
         * Delete a driver (admins only)
         * @description Soft delete: hidden from lists, their phone and plate free again. 409
         *     DRIVER_ASSIGNED while they drive a route.
         */
        delete: operations["drivers_delete"];
        options?: never;
        head?: never;
        /**
         * Change a driver, or deactivate them
         * @description Leave out what stays. Setting what is there changes nothing. 409 DRIVER_ASSIGNED:
         *     deactivating them while they drive a route (take them off it first).
         */
        patch: operations["drivers_update"];
        trace?: never;
    };
    "/v1/offers/{offer_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One offer
         * @description `expired` once its 48 hours pass, whether or not anything ran since.
         */
        get: operations["offers_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/offers/{offer_id}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept an offer for the person (by phone)
         * @description Requires `Idempotency-Key`. The seat becomes theirs: a rider is made from the request
         *     if they have none (A to B, round trip; edit it after), a place from the offer's 1st
         *     (a reservation on a forming route); the request is fulfilled.
         *
         *     - 409 OFFER_CLOSED: accepted, withdrawn, or past its 48 hours.
         *     - 409 RIDER_HAS_SEAT: they ride another route: move them instead (`PUT /v1/riders/{id}/seat`).
         *     - 409 RIDER_EXISTS: another adult rider has the request's phone (staff sort out who is
         *       who).
         */
        post: operations["offers_accept"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/offers/{offer_id}/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Withdraw an offer
         * @description The person said no (or the offer was a mistake): the seat is free for the next
         *     request. 409 OFFER_CLOSED when it isn't open.
         */
        post: operations["offers_withdraw"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Counts for the home page
         * @description Live records only: routes by status (forming ones ready to launch, active ones with
         *     no driver), riders (riding today, reserved), open route requests and seat offers,
         *     active drivers. A snapshot: counts can move a moment later. It takes no parameters:
         *     422 VALIDATION_FAILED for any.
         */
        get: operations["overview_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/areas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Areas to choose from
         * @description Oldest first. `q` finds names starting with it, ignoring case. 60 reads a minute
         *     per caller, shared with `/v1/public/routes`.
         */
        get: operations["public_areas_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/offers/{offer_id}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept your offer (website)
         * @description Public: the phone the request gave, verified (GZ-031; the token is spent). Requires
         *     `Idempotency-Key`. 404 for an offer that isn't theirs, as for one that doesn't exist;
         *     409 RIDER_EXISTS when another rider has their phone (call Gize). Limits: 5 an hour per
         *     caller, 3 a day per phone.
         */
        post: operations["public_offers_accept"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/routes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Public routes for a trip
         * @description Public routes taking a rider from `from_area_id` (A, or an area the route serves) to
         *     `to_area_id` (B), oldest first: `forming` ones take reservations, `active` and `paused`
         *     ones requests. Unknown areas list none. 60 reads a minute per caller, shared with
         *     `/v1/public/areas`.
         */
        get: operations["public_routes_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/registrations/adult": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * An adult signs up
         * @description Creates the rider (the phone is the token's) and, with a `route_id`: a reservation
         *     on a `forming` route with a free seat, from the next 1st; a request for an `active` or
         *     `paused` one (never a place directly: freed seats go to the oldest request). Without
         *     one: a request for a route between the two areas, when no route takes them (forming
         *     ones all full count as none). Requires `Idempotency-Key`; a retry with it replays the
         *     answer, uncounted, even after the token has expired.
         *
         *     - 401 PHONE_NOT_VERIFIED: the token is missing, invalid, expired or already used:
         *       verify the phone again.
         *     - 409 RIDER_EXISTS: this phone already has a rider: call Gize to change it.
         *     - 409 ROUTE_FULL: no seat left on the forming route; nothing was kept and the token
         *       still works (pick another route, or ask without one).
         *     - 409 ROUTE_REQUEST_EXISTS: the same request was recorded at the same moment. One
         *       staff recorded earlier is linked to the rider instead (it keeps its place).
         *     - 422 on `route_id`: not a route for these areas the app can sign up to, or none
         *       chosen while one would take them; on `saturday`: the route has no Saturday add-on.
         *     - 429 RATE_LIMITED: 5 an hour per caller, 3 a day per phone.
         *     - 503 SERVICE_UNAVAILABLE: sign-up is switched off, or the limits can't be checked.
         */
        post: operations["registrations_adult"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/riders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Riders, newest first
         * @description Each with the seat they hold (today or later) and their open requests; phones
         *     masked. Deleted riders are not listed.
         */
        get: operations["riders_list"];
        put?: never;
        /**
         * Record an adult rider
         * @description Requires `Idempotency-Key`. 409 RIDER_EXISTS: a live adult has this phone. Areas
         *     that don't exist (or are deleted) are a 422 on their field.
         */
        post: operations["riders_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/riders/lookup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Find riders by phone
         * @description Reads only: a POST so the phone stays out of URLs and logs. Live riders with that
         *     phone, newest first (none: an empty list).
         */
        post: operations["riders_lookup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/riders/{rider_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One rider
         * @description With the phone in full, the seat they hold and their open requests.
         */
        get: operations["riders_get"];
        put?: never;
        post?: never;
        /**
         * Delete a rider (admins only)
         * @description Soft delete: hidden from lists, their phone free again; history keeps them. 409
         *     RIDER_HAS_SEAT while they hold a seat today or later: end it first.
         */
        delete: operations["riders_delete"];
        options?: never;
        head?: never;
        /**
         * Change a rider
         * @description Leave out what stays. Setting what is there changes nothing.
         *
         *     - 409 RIDER_EXISTS: another live adult has the new phone.
         *     - 422 on an area or `saturday_addon`: the rider holds a seat and the change wouldn't
         *       fit its route (boarding at A or an area it serves, going to B, Saturday where
         *       offered), or the area doesn't exist.
         */
        patch: operations["riders_update"];
        trace?: never;
    };
    "/v1/riders/{rider_id}/seat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Give a rider a seat, or move them
         * @description Requires `Idempotency-Key`. An adult rides a public route that takes their trip
         *     (a reservation on a `forming` one, a place on an `active` one) from a 1st; a company
         *     rider their company's `active` or `paused` route (not a draft) from any day. A move
         *     ends the seat they hold the day before (a reservation just ends).
         *
         *     - 409 ROUTE_FULL: not a seat free on every day from the start (record a route request).
         *     - 409 ROUTE_HAS_WAITING_REQUESTS: an adult on an active route ahead of other people's
         *       open requests for it: send a `skip_reason` (kept and audited). Their own requests for
         *       it are fulfilled.
         *     - 409 ALREADY_ON_ROUTE: they hold a seat on it that isn't ending. On the route of a
         *       seat they are leaving, the end is undone instead (and a move still to come ends).
         *     - 409 RIDER_MOVING: a move is already planned: undo it first (place them back on
         *       their current route).
         *     - 409 ROUTE_NOT_READY: a company rider whose company isn't active.
         *     - 422 on `route_id`: a route that doesn't take this rider, or a forming one for
         *       someone riding now (it may launch late); on `start_date`: not a coming 1st for an
         *       adult, past, or more than a year ahead.
         */
        put: operations["riders_place"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/riders/{rider_id}/seat/end": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * A rider leaves their route
         * @description Requires `Idempotency-Key`. An adult leaves at a month's end (this month's by
         *     default; the seat stays empty until the next month), a company rider on any day (today
         *     by default). A reservation, or a seat not started by then, ends at once.
         *
         *     - 409 RIDER_HAS_NO_SEAT: they hold none.
         *     - 422 on `end_date`: not a month's last day for an adult, past, or more than a year
         *       ahead.
         */
        post: operations["riders_end_seat"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/route-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Route requests, oldest first
         * @description Oldest first: the order free seats are offered in.
         */
        get: operations["route_requests_list"];
        put?: never;
        /**
         * Record a route request
         * @description A `new` request from `staff`. Requires `Idempotency-Key`. 409 ROUTE_REQUEST_EXISTS:
         *     the same rider already has an open request for this. An area or route that doesn't exist
         *     or doesn't fit is a 422 on its field. A typed area name that is a listed area's, ignoring
         *     case, names that area (422 on the typed field if it is the other end's).
         */
        post: operations["route_requests_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/route-requests/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Open demand per area pair and per route
         * @description Where the next route or van should go: open new-areas requests not matched yet per
         *     area pair, and open requests per route (matched to it, else asking for it) next to its
         *     free seats next month. Busiest first, at most 100 of each.
         */
        get: operations["route_requests_summary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/route-requests/{request_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One route request
         * @description A live route request by ID, whatever its status. 404 NOT_FOUND for one that never
         *     existed or was deleted.
         */
        get: operations["route_requests_get"];
        put?: never;
        post?: never;
        /**
         * Delete a route request (admins only)
         * @description Soft delete, for a mistaken record: hidden from lists and counts; history keeps it.
         */
        delete: operations["route_requests_delete"];
        options?: never;
        head?: never;
        /**
         * Correct a route request
         * @description Who and when; what is asked for doesn't change. 409 ROUTE_REQUEST_EXISTS: the change
         *     would make it the same as another open request.
         */
        patch: operations["route_requests_update"];
        trace?: never;
    };
    "/v1/route-requests/{request_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Match, fulfil or decline a route request
         * @description `new` → `matched` (`matched_route_id`) → `fulfilled`; `new` → `fulfilled`; `new` or
         *     `matched` → `declined` (`decline_reason`). A matched request may be matched to another
         *     route. The status it has changes nothing.
         *
         *     - 409 INVALID_STATUS_CHANGE: any other move (fulfilled and declined are final).
         *     - 422 on `matched_route_id`: not a live route for this rider (public for adults;
         *       student, of their school, for students).
         */
        put: operations["route_requests_set_status"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Routes, newest first
         * @description With corridor, areas, company, and seats taken and free this month and next.
         */
        get: operations["routes_list"];
        put?: never;
        /**
         * Add a route
         * @description A `draft` route. Requires `Idempotency-Key`. 409 ROUTE_CODE_TAKEN: a live route has
         *     this code. A corridor or company that doesn't exist (or a company that isn't active) is
         *     a 422 on its field.
         */
        post: operations["routes_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One route
         * @description A live route by ID: seats taken and free (this month and next), launch progress, and
         *     the status changes possible from here, each ready or blocked (`status_changes`). 404
         *     NOT_FOUND for one that never existed or was deleted.
         */
        get: operations["routes_get"];
        put?: never;
        post?: never;
        /**
         * Delete a route (admins only)
         * @description Soft delete: hidden from lists, its code free again; history keeps it.
         *
         *     - 409 ROUTE_HAS_RIDERS: anyone is reserved or rides today or later.
         *     - 409 ROUTE_HAS_REQUESTS: an open route request asks for it or was matched to it.
         */
        delete: operations["routes_delete"];
        options?: never;
        head?: never;
        /**
         * Change a route
         * @description Leave out what stays. The type is fixed.
         *
         *     - 409 ROUTE_HAS_RIDERS: corridor, school or company while riders hold seats.
         *     - 409 ROUTE_HAS_REQUESTS, ROUTE_HAS_PRICES: corridor or school once open route requests
         *       name the route, or once it has prices (to serve somewhere else, add a route).
         *     - 409 SEATS_BELOW_TAKEN: fewer seats than are taken on some day from today.
         *     - 409 SEATS_BELOW_LAUNCH_MINIMUM: the launch minimum above the stored seats, or seats
         *       below the stored minimum (both in one request and in disagreement: 422).
         */
        patch: operations["routes_update"];
        trace?: never;
    };
    "/v1/routes/{route_id}/areas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set the areas a route serves
         * @description The areas the route passes between A and B, where riders board or get off, in order
         *     (no times: a route is A to B). The whole list at once; empty clears it. Not A or B
         *     themselves, each once, live areas, at most 20 (a 422 on `area_ids` otherwise).
         *
         *     - 409 ROUTE_HAS_RIDERS: the list drops an area where a rider holding a seat boards
         *       (GZ-032).
         */
        put: operations["routes_set_areas"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/copies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add a van: copy a route
         * @description A new route like this one, for when it's full: corridor, type, school or company,
         *     times, prices (copied, never changed here) and served areas, with its own code and
         *     seats, and its own launch minimum: required for public and student routes, refused for
         *     corporate ones (a 422 on `launch_minimum` otherwise). It starts `forming` when the
         *     original has both prices (corporate: `draft`), else `draft`, and names the original in
         *     `copied_from_route_id`. Requires `Idempotency-Key`.
         *
         *     - 409 ROUTE_CODE_TAKEN: a live route has this code.
         *     - 409 ROUTE_NOT_READY: a corporate route whose company isn't active.
         */
        post: operations["routes_copy"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/driver": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set who drives a route
         * @description `driver_id`: an active driver, or null for none (GZ-053). A driver may drive several
         *     routes whose runs don't overlap in time.
         *
         *     - 409 DRIVER_BUSY: one of their other routes runs at the same time.
         *     - 422 on `driver_id`: unknown, deleted or inactive.
         */
        put: operations["routes_set_driver"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/launch-messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The SMS a route's launch sent its riders
         * @description Each rider the latest launch started, and their SMS: `sent` (the gateway took it),
         *     `sending` (right now), `unconfirmed` (no answer from the gateway: it may have arrived),
         *     `failed` or `pending` (not tried yet; both resent by `POST .../retry`). Check it after
         *     a launch: a restart midway leaves the rest `pending`. A route never launched has none.
         */
        get: operations["routes_launch_messages"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/launch-messages/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resend a launch's failed SMS
         * @description Requires `Idempotency-Key` (a retried request replays, starting nothing more).
         *     Sends, after this answer, each `failed` or `pending` message again: never one `sent`,
         *     `sending`, or `unconfirmed` (it may have arrived: call the rider if unsure). 202 with
         *     the messages as they were.
         */
        post: operations["routes_retry_launch_messages"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/launch-months": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The months a route can launch
         * @description Every `launch_date` a launch may name (the 1st of each month, from the earliest to a
         *     year ahead), with the riders reserved for it and whether a launch that day would be
         *     accepted now (`ready`: the route is forming and they reach its launch minimum). Other
         *     routes show their reservations, never ready. A snapshot: a launch can still be refused
         *     if riders leave meanwhile.
         */
        get: operations["routes_launch_months"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/offer-queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Who a route's free seat goes to, in order
         * @description The open requests waiting for the route (asked for it, or matched to it), in the
         *     order `offers_create` picks: `position` 1 is whom it offers the seat to by default.
         *     Oldest first, but requests offered a seat on this route before (`offered_before`: it
         *     expired or was withdrawn) after the others. Then those that can't be offered a seat,
         *     oldest first, with the reason (`not_offerable`): an open offer on any route, or a
         *     student's request. Positions continue from page to page, as of each page's read. Any
         *     route, even one that can't be offered from (only forming and active public ones can).
         */
        get: operations["offers_queue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/offers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * A route's offers, newest first
         * @description Every offer the route made, whatever its status (`expired` once its 48 hours pass),
         *     newest first. 404 NOT_FOUND for a route that never existed or was deleted.
         */
        get: operations["offers_list"];
        put?: never;
        /**
         * Offer a route's free seat
         * @description Requires `Idempotency-Key`. Offers the seat for 48 hours (it holds it meanwhile) to
         *     the oldest adult request waiting for the route (asked for it, or matched to it), or to
         *     `request_id` (ahead of older ones: a `skip_reason`, audited). The person gets an SMS
         *     after the answer (`sms_status` on the offer; a failure keeps it: call them).
         *
         *     - 409 ROUTE_NOT_READY: not a forming or active public route.
         *     - 409 ROUTE_FULL: no seat free from the start (riders and open offers counted).
         *     - 409 NO_WAITING_REQUESTS: nobody waits for the route.
         *     - 409 ROUTE_HAS_WAITING_REQUESTS: `request_id` passes older requests: send a reason.
         *     - 409 OFFER_OPEN: that request has an open offer.
         *     - 422 on `request_id`: not waiting for this route; on `start_date`: not a coming 1st.
         */
        post: operations["offers_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/prices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set a route's prices (admins only)
         * @description Round trip and one-way, whole birr a month; Saturday add-on on public routes only
         *     (left out or null: none). Staff can't change prices through any endpoint.
         *
         *     - 409 ROUTE_HAS_NO_PRICES: a corporate route (billed per company).
         *     - 409 ROUTE_HAS_RIDERS: clearing the Saturday price while a rider holding a seat has
         *       the add-on (GZ-032).
         *
         *     A malformed body is a 422 before the route is looked at (so before any 404 or 409).
         */
        put: operations["routes_set_prices"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/routes/{route_id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Move a route to another status
         * @description Public and student routes: `draft` → `forming` → `active` ⇄ `paused`, and `forming`
         *     → `draft`. Corporate routes: `draft` → `active` ⇄ `paused`. The status a route already
         *     has changes nothing.
         *
         *     Launching (`forming` → `active`) takes `launch_date`, the 1st of a month from today to
         *     a year ahead (a 422 on `launch_date` otherwise, or when another move sends one). Riders
         *     reserved for that month or earlier must reach the launch minimum; they all start that
         *     day, and later reservations from their own date.
         *
         *     - 409 INVALID_STATUS_CHANGE: any other move.
         *     - 409 ROUTE_NOT_READY: forming without round-trip and one-way prices; a corporate
         *       route starting while its company isn't active.
         *     - 409 NOT_ENOUGH_RIDERS: fewer riders reserved for the launch month than the minimum.
         *     - 409 ROUTE_HAS_RIDERS: back to draft while someone is reserved (today or later).
         *
         *     After a launch, each rider it started gets an SMS, sent after this answer (GZ-041;
         *     see `GET /launch-messages`). A repeated launch sends nothing more.
         */
        put: operations["routes_set_status"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/staff": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Staff members, newest first (admins only)
         * @description Every staff member, deactivated ones included unless filtered out.
         */
        get: operations["staff_list"];
        put?: never;
        /**
         * Invite a staff member (admins only)
         * @description Supabase emails them a link to set a password. They are active staff in `role` at
         *     once, and can sign in when they have accepted. Requires `Idempotency-Key`. Each admin
         *     may send 20 invites an hour (refusals and replays do not count).
         *
         *     - 409 STAFF_EMAIL_TAKEN: a staff member, active or not, has this email (reactivate them).
         *     - 409 AUTH_ACCOUNT_EXISTS: the email already has a sign-in account. An operator deletes
         *       that Supabase user if it should not exist, then the invite can be sent (README).
         *     - 503: Supabase could not send the invite; retrying with the same key is safe.
         */
        post: operations["staff_invite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/staff/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * The signed-in staff member
         * @description Your ID, name, email and role. The admin portal calls it after sign-in.
         */
        get: operations["staff_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/staff/{staff_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * One staff member (admins only)
         * @description Admins only (403 FORBIDDEN otherwise). A staff member by ID, active or not. 404
         *     NOT_FOUND for an ID that isn't staff.
         */
        get: operations["staff_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change a staff member's name, role or status (admins only)
         * @description Correct a name, promote, demote, deactivate or reactivate. The email can't change
         *     (it is the person's sign-in). No Idempotency-Key: setting a value that is already there
         *     changes nothing.
         *
         *     - 409 LAST_ACTIVE_ADMIN: the change would leave no active admin.
         */
        patch: operations["staff_update"];
        trace?: never;
    };
    "/v1/verification/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Send a code to a phone
         * @description Sends a six-digit code by SMS, valid 10 minutes, then answers with the verification
         *     to check it against. Requires `Idempotency-Key`: a retry with it never sends a second
         *     SMS, except after a 503 SMS_UNAVAILABLE (nothing went out; the retry tries again).
         *
         *     - 429 RATE_LIMITED: 3 codes an hour per phone, 10 per caller.
         *     - 503 SMS_UNAVAILABLE: the SMS couldn't be sent (Retry-After).
         *     - 503 SERVICE_UNAVAILABLE: verification is switched off, or the limits can't be checked.
         */
        post: operations["verification_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/verification/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Check a code; get a verified-phone token
         * @description The right code answers a token proving the phone, valid 30 minutes and good for one
         *     sign-up. Not idempotent: a retry after a lost answer finds the code used (410) and the
         *     app asks for a new one.
         *
         *     - 422 VERIFICATION_CODE_INVALID: wrong code (five tries per code).
         *     - 410 VERIFICATION_EXPIRED: expired, already used, out of tries, or unknown: ask for a
         *       new code.
         *     - 429 RATE_LIMITED: 30 checks an hour per caller.
         */
        post: operations["verification_verify"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** ActiveCount */
        ActiveCount: {
            /** Active */
            active: number;
        };
        /** AdultRegistered */
        AdultRegistered: {
            /** @description `reserved`: a seat on a forming route, from `start_date` once it launches. `requested`: a request for the route (or the areas); Gize offers a seat when one frees up or a route starts. */
            outcome: components["schemas"]["RegistrationOutcome"];
            /**
             * Rider Id
             * Format: uuid
             */
            rider_id: string;
            /**
             * Route Id
             * @description The route reserved on or asked for.
             */
            route_id: string | null;
            /**
             * Route Request Id
             * @description Requested only.
             */
            route_request_id: string | null;
            /**
             * Start Date
             * @description Reserved only: the 1st the seat is held from (riding starts when the route launches, on this day or a later 1st).
             */
            start_date: string | null;
        };
        /**
         * AdultRegistration
         * @description An adult signing themselves up. The phone is the one the token proves (GZ-031).
         */
        AdultRegistration: {
            /**
             * Destination Area Id
             * Format: uuid
             * @description Where they go: B.
             */
            destination_area_id: string;
            /** Full Name */
            full_name: string;
            /**
             * Home Area Id
             * Format: uuid
             * @description Where they board: A, or an area served.
             */
            home_area_id: string;
            /** @description `morning`: A to B only; `evening`: B to A only. */
            plan: components["schemas"]["RiderPlan"];
            /**
             * Route Id
             * @description A route from `GET /v1/public/routes` for these areas. None: ask for a route between them.
             */
            route_id?: string | null;
            /**
             * Saturday
             * @description The Saturday add-on (a route offering it).
             * @default false
             */
            saturday: boolean;
            /**
             * Verified Phone Token
             * @description From `POST /v1/verification/verify`: valid 30 minutes, for one sign-up.
             */
            verified_phone_token: string;
        };
        /**
         * AreaPage
         * @description A page of areas (a named schema: generated clients keep the name).
         */
        AreaPage: {
            /** Items */
            items: components["schemas"]["AreaRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** AreaPairDemand */
        AreaPairDemand: {
            from_area: components["schemas"]["AreaRef"] | null;
            /** From Area Name */
            from_area_name: string | null;
            /** Open */
            open: number;
            to_area: components["schemas"]["AreaRef"] | null;
            /** To Area Name */
            to_area_name: string | null;
        };
        /** AreaRead */
        AreaRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** AreaRef */
        AreaRef: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /**
         * AreaWrite
         * @description An area's name: trimmed, kept as typed, unique ignoring case.
         */
        AreaWrite: {
            /** Name */
            name: string;
        };
        /**
         * AssignmentStatus
         * @enum {string}
         */
        AssignmentStatus: "reserved" | "active" | "ended";
        /**
         * AuditEntryPage
         * @description A page of the audit log (a named schema: generated clients keep the name).
         */
        AuditEntryPage: {
            /** Items */
            items: components["schemas"]["AuditEntryRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * AuditEntryRead
         * @description One recorded change. `before`/`after` hold only the fields that changed; personal
         *     ones read "[redacted]". `actor_staff_id` is null for operator commands.
         */
        AuditEntryRead: {
            /** Action */
            action: string;
            /** Actor Staff Id */
            actor_staff_id: string | null;
            /** After */
            after: {
                [key: string]: unknown;
            } | null;
            /** Before */
            before: {
                [key: string]: unknown;
            } | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Entity Id
             * Format: uuid
             */
            entity_id: string;
            /** Entity Type */
            entity_type: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Request Id */
            request_id: string | null;
        };
        /**
         * CompanyBilling
         * @enum {string}
         */
        CompanyBilling: "postpaid";
        /**
         * CompanyCreate
         * @description A new company, active, billed `postpaid`. The phone may be typed any usual way
         *     (`0911 23 45 67`); it is stored `+251911234567`. Empty notes are no notes.
         */
        CompanyCreate: {
            /** Contact Email */
            contact_email: string;
            /** Contact Name */
            contact_name: string;
            /**
             * Contact Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            contact_phone: string;
            /** Name */
            name: string;
            /** Notes */
            notes?: string | null;
        };
        /**
         * CompanyPage
         * @description A page of companies (a named schema: generated clients keep the name).
         */
        CompanyPage: {
            /** Items */
            items: components["schemas"]["CompanyRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CompanyRead */
        CompanyRead: {
            billing: components["schemas"]["CompanyBilling"];
            /** Contact Email */
            contact_email: string;
            /** Contact Name */
            contact_name: string;
            /**
             * Contact Phone
             * @description E.164, +2519…/+2517…
             */
            contact_phone: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Is Active */
            is_active: boolean;
            /** Name */
            name: string;
            /** Notes */
            notes: string | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** CompanyRef */
        CompanyRef: {
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Name */
            name: string;
        };
        /**
         * CompanyUpdate
         * @description Change any of these (leave out what stays). `is_active: false` deactivates the
         *     company; empty notes clear them.
         */
        CompanyUpdate: {
            /** Contact Email */
            contact_email?: string;
            /** Contact Name */
            contact_name?: string;
            /**
             * Contact Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            contact_phone?: string;
            /** Is Active */
            is_active?: boolean;
            /** Name */
            name?: string;
            /** Notes */
            notes?: string;
        };
        /**
         * CorridorCreate
         * @description From one area to another (two different areas).
         */
        CorridorCreate: {
            /**
             * Destination Area Id
             * Format: uuid
             */
            destination_area_id: string;
            /**
             * Origin Area Id
             * Format: uuid
             */
            origin_area_id: string;
        };
        /**
         * CorridorPage
         * @description A page of corridors (a named schema: generated clients keep the name).
         */
        CorridorPage: {
            /** Items */
            items: components["schemas"]["CorridorRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** CorridorRead */
        CorridorRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            destination_area: components["schemas"]["AreaRef"];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            origin_area: components["schemas"]["AreaRef"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** CorridorRef */
        CorridorRef: {
            destination_area: components["schemas"]["AreaRef"];
            /**
             * Id
             * Format: uuid
             */
            id: string;
            origin_area: components["schemas"]["AreaRef"];
        };
        /**
         * CorridorUpdate
         * @description Change one end or both; the result must still be two different areas.
         */
        CorridorUpdate: {
            /**
             * Destination Area Id
             * Format: uuid
             */
            destination_area_id?: string;
            /**
             * Origin Area Id
             * Format: uuid
             */
            origin_area_id?: string;
        };
        /**
         * DriverCreate
         * @description A driver: the phone typed any usual way (stored `+2519…`), the plate any case or
         *     spacing (stored in capitals, single spaces).
         */
        DriverCreate: {
            /** Address */
            address: string;
            /** Full Name */
            full_name: string;
            /**
             * Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            phone: string;
            /**
             * Plate
             * @description The van they drive, e.g. AA 3-B12345.
             */
            plate: string;
        };
        /**
         * DriverPage
         * @description A page of drivers (a named schema: generated clients keep the name).
         */
        DriverPage: {
            /** Items */
            items: components["schemas"]["DriverRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** DriverRead */
        DriverRead: {
            /** Address */
            address: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Is Active */
            is_active: boolean;
            /**
             * Phone
             * @description E.164, +2519…/+2517…
             */
            phone: string;
            /** Plate */
            plate: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** DriverRef */
        DriverRef: {
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** Plate */
            plate: string;
        };
        /**
         * DriverUpdate
         * @description Change any of these (leave out what stays). `is_active: false` deactivates them.
         */
        DriverUpdate: {
            /** Address */
            address?: string;
            /** Full Name */
            full_name?: string;
            /** Is Active */
            is_active?: boolean;
            /**
             * Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            phone?: string;
            /** Plate */
            plate?: string;
        };
        /**
         * ErrorCode
         * @description Stable error codes: never rename or reuse one; only add.
         * @enum {string}
         */
        ErrorCode: "BAD_REQUEST" | "CORS_PREFLIGHT_REJECTED" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "PAYLOAD_TOO_LARGE" | "VALIDATION_FAILED" | "INVALID_CURSOR" | "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENCY_KEY_MISMATCH" | "IDEMPOTENCY_IN_PROGRESS" | "RATE_LIMITED" | "STAFF_EMAIL_TAKEN" | "AUTH_ACCOUNT_EXISTS" | "LAST_ACTIVE_ADMIN" | "AREA_NAME_TAKEN" | "AREA_IN_USE" | "CORRIDOR_EXISTS" | "COMPANY_NAME_TAKEN" | "ROUTE_CODE_TAKEN" | "SEATS_BELOW_TAKEN" | "SEATS_BELOW_LAUNCH_MINIMUM" | "ROUTE_HAS_RIDERS" | "CORRIDOR_IN_USE" | "COMPANY_IN_USE" | "ROUTE_HAS_NO_PRICES" | "ROUTE_NOT_READY" | "NOT_ENOUGH_RIDERS" | "INVALID_STATUS_CHANGE" | "ROUTE_REQUEST_EXISTS" | "ROUTE_HAS_REQUESTS" | "ROUTE_HAS_PRICES" | "SMS_UNAVAILABLE" | "VERIFICATION_CODE_INVALID" | "VERIFICATION_EXPIRED" | "PHONE_NOT_VERIFIED" | "RIDER_EXISTS" | "ROUTE_FULL" | "RIDER_HAS_SEAT" | "RIDER_HAS_NO_SEAT" | "ALREADY_ON_ROUTE" | "RIDER_MOVING" | "ROUTE_HAS_WAITING_REQUESTS" | "OFFER_OPEN" | "OFFER_CLOSED" | "NO_WAITING_REQUESTS" | "DRIVER_EXISTS" | "PLATE_TAKEN" | "DRIVER_BUSY" | "DRIVER_ASSIGNED" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE";
        /** FieldError */
        FieldError: {
            /** Field */
            field: string;
            /**
             * Location
             * @enum {string}
             */
            location: "body" | "query" | "path" | "header" | "cookie";
            reason: components["schemas"]["ValidationReason"];
        };
        /** LaunchMessage */
        LaunchMessage: {
            /**
             * Attempts
             * @description SMS sent or tried for this launch.
             */
            attempts: number;
            /** Full Name */
            full_name: string;
            /**
             * Rider Id
             * Format: uuid
             */
            rider_id: string;
            /**
             * Start Date
             * Format: date
             * @description Their first day, as the SMS says.
             */
            start_date: string;
            status: components["schemas"]["LaunchMessageStatus"];
        };
        /**
         * LaunchMessageStatus
         * @enum {string}
         */
        LaunchMessageStatus: "sent" | "sending" | "unconfirmed" | "failed" | "pending";
        /**
         * LaunchMessages
         * @description The SMS the route's latest launch sends its riders (one each; never a second once
         *     one was sent). A route never launched has none.
         */
        LaunchMessages: {
            /** Failed */
            failed: number;
            /** Launch Date */
            launch_date: string | null;
            /** Pending */
            pending: number;
            /** Riders */
            riders: components["schemas"]["LaunchMessage"][];
            /** Sending */
            sending: number;
            /** Sent */
            sent: number;
            /** Total */
            total: number;
            /**
             * Unconfirmed
             * @description May have arrived: not resent; call if unsure.
             */
            unconfirmed: number;
        };
        /** LaunchMonth */
        LaunchMonth: {
            /**
             * Launch Date
             * Format: date
             */
            launch_date: string;
            /**
             * Ready
             * @description A launch that day would be accepted now: the route is forming and `reserved` reaches the launch minimum.
             */
            ready: boolean;
            /**
             * Reserved
             * @description Riders a launch that day would start.
             */
            reserved: number;
        };
        /**
         * MonthSeats
         * @description On the busiest day of each: from today to the end of this month, and all of next.
         */
        MonthSeats: {
            /** Next Month */
            next_month: number;
            /** This Month */
            this_month: number;
        };
        /**
         * NotOfferable
         * @description Why a request waiting for a route can't be offered its seat (GZ-075): it has an open
         *     offer (on any route), or it's a student's (seats are offered to adults).
         * @enum {string}
         */
        NotOfferable: "open_offer" | "student";
        /**
         * OfferCreate
         * @description Offer the route's free seat. Leave `request_id` out for the oldest request waiting
         *     for the route; another one ahead of older ones needs `skip_reason` (audited).
         *     `start_date`: on an active route, the 1st the seat is free from (the next by default);
         *     a forming route's offer is a reservation from the next 1st.
         */
        OfferCreate: {
            /** Request Id */
            request_id?: string | null;
            /** Skip Reason */
            skip_reason?: string | null;
            /** Start Date */
            start_date?: string | null;
        };
        /**
         * OfferPage
         * @description A page of offers (a named schema: generated clients keep the name).
         */
        OfferPage: {
            /** Items */
            items: components["schemas"]["OfferRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** OfferQueueItem */
        OfferQueueItem: {
            /** @description Why it can't be offered: `open_offer` (on any route) or `student` (seats are offered to adults). */
            not_offerable: components["schemas"]["NotOfferable"] | null;
            /**
             * Offered Before
             * @description Offered a seat on this route before that expired or was withdrawn. Among requests that can be offered a seat, these come after the others.
             */
            offered_before: boolean;
            /**
             * Position
             * @description 1 is whom "Offer a free seat" picks; another needs a `skip_reason`. `null` when the request can't be offered a seat (`not_offerable`).
             */
            position: number | null;
            request: components["schemas"]["RouteRequestRead"];
        };
        /**
         * OfferQueuePage
         * @description A page of a route's offer queue (a named schema: generated clients keep the name).
         */
        OfferQueuePage: {
            /** Items */
            items: components["schemas"]["OfferQueueItem"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** OfferRead */
        OfferRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Request Id
             * Format: uuid
             */
            request_id: string;
            /**
             * Rider Id
             * @description Accepted: the rider who took the seat.
             */
            rider_id: string | null;
            /**
             * Rider Name
             * @description Who asked.
             */
            rider_name: string;
            /** Route Code */
            route_code: string;
            /**
             * Route Id
             * Format: uuid
             */
            route_id: string;
            /** Skip Reason */
            skip_reason: string | null;
            /** @description The offer's SMS: `sent`, `failed` (call them) or `sending`. */
            sms_status: components["schemas"]["SmsStatus"] | null;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /** @description `open` (holds the seat until `expires_at`), `accepted`, `expired` or `withdrawn`. */
            status: components["schemas"]["OfferStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * OfferStatus
         * @enum {string}
         */
        OfferStatus: "open" | "accepted" | "expired" | "withdrawn";
        /** OpenCount */
        OpenCount: {
            /** Open */
            open: number;
        };
        /**
         * Overview
         * @description Counts for the admin home page, live records only, as of `as_of` (Addis Ababa).
         */
        Overview: {
            /**
             * As Of
             * Format: date
             */
            as_of: string;
            drivers: components["schemas"]["ActiveCount"];
            riders: components["schemas"]["RiderCounts"];
            /** @description New or matched. */
            route_requests: components["schemas"]["OpenCount"];
            routes: components["schemas"]["RouteCounts"];
            /** @description Open, within their 48 hours, their request still waiting: the seats offers hold. */
            seat_offers: components["schemas"]["OpenCount"];
        };
        /** PhoneVerified */
        PhoneVerified: {
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /**
             * Verified Phone Token
             * @description Present it when signing up, within 30 minutes; it works once.
             */
            verified_phone_token: string;
        };
        /**
         * Prices
         * @description Whole birr a month; null until an admin sets them (GZ-022). Saturday: public only.
         */
        Prices: {
            /** One Way */
            one_way: number | null;
            /** Round Trip */
            round_trip: number | null;
            /** Saturday */
            saturday: number | null;
        };
        /** Problem */
        Problem: {
            code: components["schemas"]["ErrorCode"];
            /** Request Id */
            request_id: string | null;
            /** Status */
            status: number;
            /** Title */
            title: string;
            /**
             * Type
             * @default about:blank
             */
            type: string;
        };
        /**
         * PublicAreaPage
         * @description A page of areas (a named schema: generated clients keep the name).
         */
        PublicAreaPage: {
            /** Items */
            items: components["schemas"]["AreaRef"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * PublicOfferAccept
         * @description The asker's phone, verified (GZ-031): it must be the request's.
         */
        PublicOfferAccept: {
            /** Verified Phone Token */
            verified_phone_token: string;
        };
        /**
         * PublicOfferAccepted
         * @description What the website shows: nothing about anyone else.
         */
        PublicOfferAccepted: {
            /** Route Code */
            route_code: string;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            status: components["schemas"]["OfferStatus"];
        };
        /**
         * PublicPrices
         * @description Whole birr a month. Saturday: an add-on, when the route offers one.
         */
        PublicPrices: {
            /** One Way */
            one_way: number;
            /** Round Trip */
            round_trip: number;
            /** Saturday */
            saturday: number | null;
        };
        /** PublicRoute */
        PublicRoute: {
            /** Code */
            code: string;
            /** @description B: where the morning run ends. */
            destination_area: components["schemas"]["AreaRef"];
            /**
             * Full
             * @description No free seat from the next 1st (today, on the 1st): the earliest a new rider could start. On a running route, a seat freed later goes to the oldest request.
             */
            full: boolean;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Morning Arrival Time
             * @description Arrives at B (null only on routes made before arrival times existed).
             */
            morning_arrival_time: string | null;
            /**
             * Morning Time
             * @description Leaves A.
             */
            morning_time: string;
            /** @description A: where the morning run starts. */
            origin_area: components["schemas"]["AreaRef"];
            prices: components["schemas"]["PublicPrices"];
            /**
             * Return Arrival Time
             * @description Arrives at A (null only on routes made before arrival times existed).
             */
            return_arrival_time: string | null;
            /**
             * Return Time
             * @description Leaves B.
             */
            return_time: string;
            /**
             * Served Areas
             * @description Areas passed between A and B, in order.
             */
            served_areas: components["schemas"]["AreaRef"][];
            /** @description `forming`: a sign-up reserves a seat until it launches (unless full). `active` or `paused`: a sign-up becomes a request for a seat. */
            status: components["schemas"]["RouteStatus"];
        };
        /**
         * PublicRoutePage
         * @description A page of public routes (a named schema: generated clients keep the name).
         */
        PublicRoutePage: {
            /** Items */
            items: components["schemas"]["PublicRoute"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * RecordedType
         * @description The riders staff record: adults (who may also sign up themselves) and company
         *     riders.
         * @enum {string}
         */
        RecordedType: "adult" | "corporate";
        /**
         * RegistrationOutcome
         * @enum {string}
         */
        RegistrationOutcome: "reserved" | "requested";
        /**
         * RequestKind
         * @enum {string}
         */
        RequestKind: "new_areas" | "route";
        /**
         * RequestSource
         * @enum {string}
         */
        RequestSource: "staff" | "app";
        /**
         * RequestStatus
         * @enum {string}
         */
        RequestStatus: "new" | "matched" | "fulfilled" | "declined";
        /** RiderCounts */
        RiderCounts: {
            /**
             * Reserved
             * @description Holding a reservation on a forming route.
             */
            reserved: number;
            /**
             * Riding
             * @description Holding an active seat today.
             */
            riding: number;
            /** Total */
            total: number;
        };
        /**
         * RiderCreate
         * @description A rider recorded by staff. The phone may be typed any usual way (`0911 23 45 67`);
         *     it is stored `+251911234567`.
         *
         *     - `adult` (from a phone call): home and destination areas, plan, Saturday add-on.
         *     - `corporate` (GZ-035): their `company_id` and where they board (`home_area_id`); no
         *       destination (they ride to the route's B), plan or Saturday (the company is billed).
         */
        RiderCreate: {
            /**
             * Company Id
             * Format: uuid
             * @description Company riders only.
             */
            company_id?: string;
            /**
             * Destination Area Id
             * Format: uuid
             * @description Where they go (adults only).
             */
            destination_area_id?: string;
            /** Full Name */
            full_name: string;
            /**
             * Home Area Id
             * Format: uuid
             * @description Where they board.
             */
            home_area_id: string;
            /**
             * Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            phone: string;
            /** @description Adults only. `morning`: A to B only; `evening`: B to A. */
            plan?: components["schemas"]["RiderPlan"];
            /** @default adult */
            rider_type: components["schemas"]["RecordedType"];
            /**
             * Saturday Addon
             * @default false
             */
            saturday_addon: boolean;
        };
        /** RiderListItem */
        RiderListItem: {
            /** @description Company riders only. */
            company: components["schemas"]["CompanyRef"] | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            destination_area: components["schemas"]["AreaRef"] | null;
            /** Full Name */
            full_name: string;
            home_area: components["schemas"]["AreaRef"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** @description While moving: the seat that starts after `seat` ends (GZ-035). */
            next_seat: components["schemas"]["SeatRef"] | null;
            /**
             * Open Requests
             * @description Their open route requests (new or matched).
             */
            open_requests: number;
            /**
             * Phone Masked
             * @description `+2519****4567`: enough to tell callers apart.
             */
            phone_masked: string | null;
            plan: components["schemas"]["RiderPlan"] | null;
            rider_type: components["schemas"]["gize_api__riders__models__RiderType"];
            /** Saturday Addon */
            saturday_addon: boolean;
            /** @description The seat held now, or the next to start. */
            seat: components["schemas"]["SeatRef"] | null;
            /** @description `app`: signed up themselves; `staff`: recorded. */
            source: components["schemas"]["RiderSource"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * RiderLookup
         * @description A phone, typed any usual way: in the body, so it never reaches a URL or a log.
         */
        RiderLookup: {
            /**
             * Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            phone: string;
        };
        /**
         * RiderMatches
         * @description Live riders with this phone (at most one adult; company riders may share later).
         */
        RiderMatches: {
            /** Items */
            items: components["schemas"]["RiderListItem"][];
        };
        /**
         * RiderPage
         * @description A page of riders (a named schema: generated clients keep the name).
         */
        RiderPage: {
            /** Items */
            items: components["schemas"]["RiderListItem"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * RiderPlan
         * @enum {string}
         */
        RiderPlan: "round_trip" | "morning" | "evening";
        /** RiderRead */
        RiderRead: {
            /** @description Company riders only. */
            company: components["schemas"]["CompanyRef"] | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            destination_area: components["schemas"]["AreaRef"] | null;
            /** Full Name */
            full_name: string;
            home_area: components["schemas"]["AreaRef"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /** @description While moving: the seat that starts after `seat` ends (GZ-035). */
            next_seat: components["schemas"]["SeatRef"] | null;
            /**
             * Open Requests
             * @description Their open route requests (new or matched).
             */
            open_requests: number;
            /**
             * Phone
             * @description E.164, in full.
             */
            phone: string | null;
            plan: components["schemas"]["RiderPlan"] | null;
            rider_type: components["schemas"]["gize_api__riders__models__RiderType"];
            /** Saturday Addon */
            saturday_addon: boolean;
            /** @description The seat held now, or the next to start. */
            seat: components["schemas"]["SeatRef"] | null;
            /** @description `app`: signed up themselves; `staff`: recorded. */
            source: components["schemas"]["RiderSource"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * RiderSource
         * @enum {string}
         */
        RiderSource: "app" | "staff";
        /**
         * RiderUpdate
         * @description Change any of these (leave out what stays). A rider holding a seat must still fit
         *     its route: boarding at A or an area it serves, going to B, Saturday only where offered
         *     (a 422 on the field otherwise). Company riders change only their name, phone and where
         *     they board; their company doesn't change (record them again).
         */
        RiderUpdate: {
            /**
             * Destination Area Id
             * Format: uuid
             */
            destination_area_id?: string;
            /** Full Name */
            full_name?: string;
            /**
             * Home Area Id
             * Format: uuid
             */
            home_area_id?: string;
            /**
             * Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            phone?: string;
            plan?: components["schemas"]["RiderPlan"];
            /** Saturday Addon */
            saturday_addon?: boolean;
        };
        /**
         * RouteAreasSet
         * @description The areas the route passes between A and B, in order: the whole list (empty: none).
         *     Not A or B themselves (the corridor's); each once; at most 20.
         */
        RouteAreasSet: {
            /** Area Ids */
            area_ids: string[];
        };
        /**
         * RouteBlocker
         * @description What stops a status change now (the 409 it would get): prices not set
         *     (ROUTE_NOT_READY), a corporate route's company not active (ROUTE_NOT_READY), someone
         *     reserved or riding today or later (ROUTE_HAS_RIDERS), fewer riders reserved for the
         *     launch day than the launch minimum (NOT_ENOUGH_RIDERS).
         * @enum {string}
         */
        RouteBlocker: "PRICES_MISSING" | "COMPANY_INACTIVE" | "ROUTE_HAS_RIDERS" | "NOT_ENOUGH_RIDERS";
        /**
         * RouteCopy
         * @description A van like the route (GZ-028): its corridor, type, school or company, times, prices
         *     and served areas are copied; it has its own code and seats, and its own launch minimum:
         *     required for public and student routes (at most its seats), refused for corporate.
         */
        RouteCopy: {
            /** Code */
            code: string;
            /** Launch Minimum */
            launch_minimum?: number | null;
            /** Seats */
            seats: number;
        };
        /** RouteCounts */
        RouteCounts: {
            /** Active */
            active: number;
            /** Active Without Driver */
            active_without_driver: number;
            /** Draft */
            draft: number;
            /** Forming */
            forming: number;
            /** Paused */
            paused: number;
            /**
             * Ready To Launch
             * @description Forming routes whose riders reserved for the next launch day reach their launch minimum.
             */
            ready_to_launch: number;
        };
        /**
         * RouteCreate
         * @description A new route, `draft`. Its type is fixed: a student route names its school, a
         *     corporate route its (active) company and has no launch minimum; a public route has
         *     neither. Times in order: leave A, arrive at B, leave B, arrive at A. Prices are set by
         *     admins (GZ-022); the areas served by their own endpoint.
         */
        RouteCreate: {
            /** Code */
            code: string;
            /** Company Id */
            company_id?: string | null;
            /**
             * Corridor Id
             * Format: uuid
             */
            corridor_id: string;
            /** Launch Minimum */
            launch_minimum?: number | null;
            /**
             * Morning Arrival Time
             * @description Arrives at B.
             */
            morning_arrival_time: string;
            /**
             * Morning Time
             * @description Leaves A.
             */
            morning_time: string;
            /**
             * Return Arrival Time
             * @description Arrives at A.
             */
            return_arrival_time: string;
            /**
             * Return Time
             * @description Leaves B.
             */
            return_time: string;
            route_type: components["schemas"]["RouteType"];
            /** School Name */
            school_name?: string | null;
            /** Seats */
            seats: number;
        };
        /** RouteDemand */
        RouteDemand: {
            /** Open */
            open: number;
            route: components["schemas"]["RouteRef"];
            /** Seats Free Next Month */
            seats_free_next_month: number;
            status: components["schemas"]["RouteStatus"];
        };
        /**
         * RouteDriverSet
         * @description The route's driver: an active driver, or null for none.
         */
        RouteDriverSet: {
            /** Driver Id */
            driver_id: string | null;
        };
        /**
         * RouteLaunchMonths
         * @description Every day a launch may name: the 1st of each month, from the earliest (today on the
         *     1st, else next month's) to a year ahead.
         */
        RouteLaunchMonths: {
            /**
             * Launch Minimum
             * @description Null on corporate routes (no launch).
             */
            launch_minimum: number | null;
            /** Months */
            months: components["schemas"]["LaunchMonth"][];
            status: components["schemas"]["RouteStatus"];
        };
        /**
         * RoutePage
         * @description A page of routes (a named schema: generated clients keep the name).
         */
        RoutePage: {
            /** Items */
            items: components["schemas"]["RouteRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * RoutePricesSet
         * @description All of a route's prices at once (admins). No Saturday price (left out or null) means
         *     no Saturday add-on; only public routes have one.
         */
        RoutePricesSet: {
            /**
             * One Way
             * @description Whole birr a month.
             */
            one_way: number;
            /**
             * Round Trip
             * @description Whole birr a month.
             */
            round_trip: number;
            /** Saturday */
            saturday?: number | null;
        };
        /** RouteRead */
        RouteRead: {
            /** Code */
            code: string;
            company: components["schemas"]["CompanyRef"] | null;
            /** Copied From Route Id */
            copied_from_route_id: string | null;
            corridor: components["schemas"]["CorridorRef"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** @description Who drives it (GZ-053). */
            driver: components["schemas"]["DriverRef"] | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            /**
             * Launch Minimum
             * @description Reserved riders needed to launch.
             */
            launch_minimum: number | null;
            /**
             * Morning Arrival Time
             * @description Arrives at B (null only on routes made before arrival times existed).
             */
            morning_arrival_time: string | null;
            /**
             * Morning Time
             * @description Leaves A.
             */
            morning_time: string;
            /** @description Null on corporate routes (billed per company). */
            prices: components["schemas"]["Prices"] | null;
            /**
             * Reserved
             * @description Riders reserved for the next launch day (the 1st): launch progress.
             */
            reserved: number;
            /**
             * Return Arrival Time
             * @description Arrives at A (null only on routes made before arrival times existed).
             */
            return_arrival_time: string | null;
            /**
             * Return Time
             * @description Leaves B.
             */
            return_time: string;
            route_type: components["schemas"]["RouteType"];
            /** School Name */
            school_name: string | null;
            /** Seats */
            seats: number;
            seats_free: components["schemas"]["MonthSeats"];
            seats_taken: components["schemas"]["MonthSeats"];
            /**
             * Served Areas
             * @description Areas passed between A and B, in order.
             */
            served_areas: components["schemas"]["AreaRef"][];
            status: components["schemas"]["RouteStatus"];
            /**
             * Status Changes
             * @description The moves allowed from this status, each ready or with what blocks it, by the rules `PUT /status` applies. A snapshot: a change can still be refused if something moved meanwhile.
             */
            status_changes: components["schemas"]["StatusChange"][];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** RouteRef */
        RouteRef: {
            /** Code */
            code: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
        };
        /**
         * RouteRequestCreate
         * @description A new request, `new`, recorded by staff.
         *
         *     - `new_areas`: each end once, a listed area (`*_area_id`) or one not listed yet
         *       (`*_area_name`); A and B different. No `route_id`.
         *     - `route`: `route_id`, a running (active or paused) route for this rider (public for
         *       adults; student, of the rider's school, for students). No areas.
         *
         *     A student names their school; an adult doesn't. The phone may be typed any usual way.
         *     One open request per phone, kind, route or area pair and rider (`ROUTE_REQUEST_EXISTS`).
         */
        RouteRequestCreate: {
            /**
             * Contact Name
             * @description Who to call: a student's parent or guardian.
             */
            contact_name: string;
            /**
             * Contact Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            contact_phone: string;
            /** From Area Id */
            from_area_id?: string | null;
            /**
             * From Area Name
             * @description An area not listed yet.
             */
            from_area_name?: string | null;
            kind: components["schemas"]["RequestKind"];
            /** Notes */
            notes?: string | null;
            /** Preferred Morning Time */
            preferred_morning_time?: string | null;
            /** Preferred Return Time */
            preferred_return_time?: string | null;
            /**
             * Rider Name
             * @description Who will ride: a student's own name.
             */
            rider_name: string;
            rider_type: components["schemas"]["gize_api__route_requests__models__RiderType"];
            /** Route Id */
            route_id?: string | null;
            /** School Name */
            school_name?: string | null;
            /** To Area Id */
            to_area_id?: string | null;
            /**
             * To Area Name
             * @description An area not listed yet.
             */
            to_area_name?: string | null;
        };
        /**
         * RouteRequestPage
         * @description A page of requests (a named schema: generated clients keep the name).
         */
        RouteRequestPage: {
            /** Items */
            items: components["schemas"]["RouteRequestRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /** RouteRequestRead */
        RouteRequestRead: {
            /** Contact Name */
            contact_name: string;
            /**
             * Contact Phone
             * @description E.164, +2519…/+2517…
             */
            contact_phone: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Decline Reason */
            decline_reason: string | null;
            from_area: components["schemas"]["AreaRef"] | null;
            /** From Area Name */
            from_area_name: string | null;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            kind: components["schemas"]["RequestKind"];
            matched_route: components["schemas"]["RouteRef"] | null;
            /** Notes */
            notes: string | null;
            /** Preferred Morning Time */
            preferred_morning_time: string | null;
            /** Preferred Return Time */
            preferred_return_time: string | null;
            /** Rider Name */
            rider_name: string;
            rider_type: components["schemas"]["gize_api__route_requests__models__RiderType"];
            /** @description The route asked for (kind `route`). */
            route: components["schemas"]["RouteRef"] | null;
            /** School Name */
            school_name: string | null;
            source: components["schemas"]["RequestSource"];
            status: components["schemas"]["RequestStatus"];
            to_area: components["schemas"]["AreaRef"] | null;
            /** To Area Name */
            to_area_name: string | null;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * RouteRequestStatusSet
         * @description The status to move to. `matched` names the route (`matched_route_id`, a live route
         *     for this rider, any status: a van to come may still be a draft); `declined` gives a
         *     reason. Neither goes with another status.
         */
        RouteRequestStatusSet: {
            /** Decline Reason */
            decline_reason?: string | null;
            /** Matched Route Id */
            matched_route_id?: string | null;
            status: components["schemas"]["RequestStatus"];
        };
        /**
         * RouteRequestSummary
         * @description Busiest first, at most 100 of each (`*_truncated`: there were more).
         */
        RouteRequestSummary: {
            /**
             * Area Pairs
             * @description Open new-areas requests not matched yet, per area pair.
             */
            area_pairs: components["schemas"]["AreaPairDemand"][];
            /** Area Pairs Truncated */
            area_pairs_truncated: boolean;
            /**
             * Routes
             * @description Open requests per route: matched to it, else asking for it.
             */
            routes: components["schemas"]["RouteDemand"][];
            /** Routes Truncated */
            routes_truncated: boolean;
        };
        /**
         * RouteRequestUpdate
         * @description Correct who and when (leave out what stays; empty notes clear them). What is asked
         *     for (kind, areas, route) doesn't change: decline the request and record a new one. A
         *     school only on a student's request (still the route's, for a route request).
         */
        RouteRequestUpdate: {
            /** Contact Name */
            contact_name?: string;
            /**
             * Contact Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            contact_phone?: string;
            /** Notes */
            notes?: string;
            /**
             * Preferred Morning Time
             * @description Local Addis Ababa time, HH:MM.
             */
            preferred_morning_time?: string;
            /**
             * Preferred Return Time
             * @description Local Addis Ababa time, HH:MM.
             */
            preferred_return_time?: string;
            /** Rider Name */
            rider_name?: string;
            /** School Name */
            school_name?: string;
        };
        /**
         * RouteStatus
         * @enum {string}
         */
        RouteStatus: "draft" | "forming" | "active" | "paused";
        /**
         * RouteStatusSet
         * @description The status to move the route to. Launching a forming route (`active`) needs a
         *     `launch_date`: the 1st of a month, from today to a year ahead; no other move takes one.
         */
        RouteStatusSet: {
            /**
             * Launch Date
             * @description Launching only: the day reserved riders start (the 1st of a month).
             */
            launch_date?: string | null;
            status: components["schemas"]["RouteStatus"];
        };
        /**
         * RouteType
         * @enum {string}
         */
        RouteType: "public" | "student" | "corporate";
        /**
         * RouteUpdate
         * @description Change any of these (leave out what stays). The type can't change; corridor, school
         *     and company can't while riders hold seats (`ROUTE_HAS_RIDERS`), and the corridor not
         *     while the route serves areas (clear them first). A route made before arrival times
         *     existed gets both at once.
         */
        RouteUpdate: {
            /** Code */
            code?: string;
            /**
             * Company Id
             * Format: uuid
             */
            company_id?: string;
            /**
             * Corridor Id
             * Format: uuid
             */
            corridor_id?: string;
            /** Launch Minimum */
            launch_minimum?: number;
            /**
             * Morning Arrival Time
             * @description Local Addis Ababa time, HH:MM.
             */
            morning_arrival_time?: string;
            /**
             * Morning Time
             * @description Local Addis Ababa time, HH:MM.
             */
            morning_time?: string;
            /**
             * Return Arrival Time
             * @description Local Addis Ababa time, HH:MM.
             */
            return_arrival_time?: string;
            /**
             * Return Time
             * @description Local Addis Ababa time, HH:MM.
             */
            return_time?: string;
            /** School Name */
            school_name?: string;
            /** Seats */
            seats?: number;
        };
        /**
         * SeatEnd
         * @description When the rider leaves: an adult at a month's end (this month's by default); a
         *     company rider on any day (today by default). A reservation, or a seat that hasn't
         *     started by then, ends at once (it never rode).
         */
        SeatEnd: {
            /**
             * End Date
             * @description The last day they ride.
             */
            end_date?: string | null;
        };
        /**
         * SeatPlacement
         * @description The route to place the rider on (or move them to).
         *
         *     - `start_date`: an adult starts on a 1st (the next by default, at most a year ahead);
         *       a company rider on any day (today by default, at most a year ahead).
         *     - `skip_reason`: needed to place an adult on an active route ahead of other people's
         *       open requests for it (kept with the seat and audited).
         */
        SeatPlacement: {
            /**
             * Route Id
             * Format: uuid
             */
            route_id: string;
            /** Skip Reason */
            skip_reason?: string | null;
            /** Start Date */
            start_date?: string | null;
        };
        /**
         * SeatRef
         * @description A seat the rider holds today or later.
         */
        SeatRef: {
            /**
             * End Date
             * @description The last day held; null: ongoing.
             */
            end_date: string | null;
            /** Route Code */
            route_code: string;
            /**
             * Route Id
             * Format: uuid
             */
            route_id: string;
            /**
             * Start Date
             * Format: date
             */
            start_date: string;
            /** @description `reserved` (forming route) or `active`. */
            status: components["schemas"]["AssignmentStatus"];
        };
        /**
         * SeatState
         * @enum {string}
         */
        SeatState: "reserved" | "active" | "none";
        /**
         * SmsStatus
         * @enum {string}
         */
        SmsStatus: "sending" | "sent" | "failed";
        /**
         * StaffInvite
         * @description Who to invite. Supabase emails them a link to set a password; they are active staff
         *     from the start, and can sign in once they have accepted.
         */
        StaffInvite: {
            /** Email */
            email: string;
            /** Full Name */
            full_name: string;
            role: components["schemas"]["StaffRole"];
        };
        /**
         * StaffMe
         * @description The signed-in staff member.
         */
        StaffMe: {
            /** Email */
            email: string;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             */
            id: string;
            role: components["schemas"]["StaffRole"];
        };
        /**
         * StaffPage
         * @description A page of staff members (a named schema: generated clients keep the name).
         */
        StaffPage: {
            /** Items */
            items: components["schemas"]["StaffRead"][];
            /** Next Cursor */
            next_cursor: string | null;
        };
        /**
         * StaffRead
         * @description A staff member as admins see them.
         */
        StaffRead: {
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Email */
            email: string;
            /**
             * First Signed In At
             * @description Null until their first sign-in: an invitation not yet accepted.
             */
            first_signed_in_at: string | null;
            /** Full Name */
            full_name: string;
            /**
             * Id
             * Format: uuid
             * @description Their Supabase user ID.
             */
            id: string;
            /**
             * Is Active
             * @description False: deactivated, locked out until reactivated.
             */
            is_active: boolean;
            role: components["schemas"]["StaffRole"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * StaffRole
         * @enum {string}
         */
        StaffRole: "admin" | "staff";
        /**
         * StaffUpdate
         * @description What to change: leave a field out to keep it, and send at least one. Deactivating
         *     someone locks them out on their next request; `is_active: true` reactivates them. A
         *     name is trimmed, as in an invite. The email can't change: it is their sign-in.
         */
        StaffUpdate: {
            /** Full Name */
            full_name?: string;
            /** Is Active */
            is_active?: boolean;
            role?: components["schemas"]["StaffRole"];
        };
        /**
         * StatusChange
         * @description A move the route's type allows from its status, and whether `PUT /status` would
         *     accept it now.
         */
        StatusChange: {
            /** Blocked By */
            blocked_by: components["schemas"]["RouteBlocker"][];
            /**
             * Launch Date
             * @description A launch (`forming` → `active`): judged for this day, the earliest a launch may name (send it with the change). Other months: `GET /launch-months`.
             */
            launch_date: string | null;
            /**
             * Ready
             * @description No blockers: the change would be accepted now.
             */
            ready: boolean;
            to: components["schemas"]["RouteStatus"];
        };
        /** ValidationProblem */
        ValidationProblem: {
            code: components["schemas"]["ErrorCode"];
            /** Errors */
            errors: components["schemas"]["FieldError"][];
            /** Errors Truncated */
            errors_truncated: boolean;
            /** Request Id */
            request_id: string | null;
            /** Status */
            status: number;
            /** Title */
            title: string;
            /**
             * Type
             * @default about:blank
             */
            type: string;
        };
        /**
         * ValidationReason
         * @description Why a field failed validation: our vocabulary, not the validation library's.
         * @enum {string}
         */
        ValidationReason: "missing" | "unknown_field" | "too_long" | "too_short" | "out_of_range" | "invalid_type" | "invalid_format" | "not_allowed" | "invalid_json" | "invalid";
        /** VerificationCheck */
        VerificationCheck: {
            /**
             * Code
             * @description The six digits from the SMS (ASCII digits only).
             */
            code: string;
            /**
             * Verification Id
             * Format: uuid
             */
            verification_id: string;
        };
        /**
         * VerificationRequest
         * @description The phone to verify, typed any usual way (`0911 23 45 67`); an Ethiopian mobile.
         */
        VerificationRequest: {
            /**
             * Phone
             * @description An Ethiopian mobile, any usual spelling; stored as +2519… or +2517…
             */
            phone: string;
        };
        /** VerificationSent */
        VerificationSent: {
            /**
             * Expires At
             * Format: date-time
             * @description The code works until then (10 minutes).
             */
            expires_at: string;
            /**
             * Verification Id
             * Format: uuid
             */
            verification_id: string;
        };
        /**
         * RiderType
         * @enum {string}
         */
        gize_api__riders__models__RiderType: "adult" | "student" | "corporate";
        /**
         * RiderType
         * @description Individual riders only: company riders come through their company.
         * @enum {string}
         */
        gize_api__route_requests__models__RiderType: "adult" | "student";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    areas_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                q?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole",
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["AreaPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    areas_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AreaWrite"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new area. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *       "name": "Bole",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["AreaRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Area Name Taken, Request In Progress */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    areas_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                area_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *       "name": "Bole",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["AreaRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    areas_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                area_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Area In Use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    areas_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                area_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AreaWrite"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *       "name": "Bole",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["AreaRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Area Name Taken */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    audit_log_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                entity_type?: string | null;
                entity_id?: string | null;
                actor_staff_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "action": "driver.updated",
                     *           "actor_staff_id": "7cd08e9f-1dab-4a2f-8b5c-8d9e0f1a2b01",
                     *           "after": {
                     *             "is_active": false
                     *           },
                     *           "before": {
                     *             "is_active": true
                     *           },
                     *           "created_at": "2026-11-14T09:15:00Z",
                     *           "entity_id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *           "entity_type": "driver",
                     *           "id": "a0f3b1c2-4ade-4d5c-9e8f-1a2b3c4d5e01",
                     *           "request_id": "4b1f0c3e9a2d4e7f8c6b5a4d3e2f1a0b"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["AuditEntryPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    companies_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                q?: string | null;
                is_active?: boolean | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "billing": "postpaid",
                     *           "contact_email": "transport@example.com",
                     *           "contact_name": "Hanna Bekele",
                     *           "contact_phone": "+251911000101",
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "id": "8de19fa0-2ebc-4b3a-9c6d-9e0f1a2b3c01",
                     *           "is_active": true,
                     *           "name": "Lucy Software PLC",
                     *           "notes": null,
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["CompanyPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    companies_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompanyCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new company. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "billing": "postpaid",
                     *       "contact_email": "transport@example.com",
                     *       "contact_name": "Hanna Bekele",
                     *       "contact_phone": "+251911000101",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "id": "8de19fa0-2ebc-4b3a-9c6d-9e0f1a2b3c01",
                     *       "is_active": true,
                     *       "name": "Lucy Software PLC",
                     *       "notes": null,
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["CompanyRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Company Name Taken, Request In Progress */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    companies_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                company_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "billing": "postpaid",
                     *       "contact_email": "transport@example.com",
                     *       "contact_name": "Hanna Bekele",
                     *       "contact_phone": "+251911000101",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "id": "8de19fa0-2ebc-4b3a-9c6d-9e0f1a2b3c01",
                     *       "is_active": true,
                     *       "name": "Lucy Software PLC",
                     *       "notes": null,
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["CompanyRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    companies_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                company_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Company In Use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    companies_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                company_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompanyUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "billing": "postpaid",
                     *       "contact_email": "transport@example.com",
                     *       "contact_name": "Hanna Bekele",
                     *       "contact_phone": "+251911000101",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "id": "8de19fa0-2ebc-4b3a-9c6d-9e0f1a2b3c01",
                     *       "is_active": true,
                     *       "name": "Lucy Software PLC",
                     *       "notes": null,
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["CompanyRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Company In Use, Company Name Taken */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    corridors_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                origin_area_id?: string | null;
                destination_area_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "destination_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *             "name": "Bole"
                     *           },
                     *           "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *           "origin_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *             "name": "CMC"
                     *           },
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["CorridorPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    corridors_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CorridorCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new corridor. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *       "origin_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["CorridorRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Corridor Exists, Request In Progress */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    corridors_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                corridor_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *       "origin_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["CorridorRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    corridors_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                corridor_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Corridor In Use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    corridors_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                corridor_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CorridorUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *       "origin_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["CorridorRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Corridor Exists, Corridor In Use */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    drivers_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                q?: string | null;
                is_active?: boolean | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "address": "Bole, Woreda 03",
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "full_name": "Dawit Alemu",
                     *           "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *           "is_active": true,
                     *           "phone": "+251911000201",
                     *           "plate": "AA 3-B12345",
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["DriverPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    drivers_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DriverCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new driver. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "address": "Bole, Woreda 03",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "full_name": "Dawit Alemu",
                     *       "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *       "is_active": true,
                     *       "phone": "+251911000201",
                     *       "plate": "AA 3-B12345",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["DriverRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Driver Exists, Plate Taken, Request In Progress */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    drivers_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                driver_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "address": "Bole, Woreda 03",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "full_name": "Dawit Alemu",
                     *       "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *       "is_active": true,
                     *       "phone": "+251911000201",
                     *       "plate": "AA 3-B12345",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["DriverRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    drivers_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                driver_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Driver Assigned */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    drivers_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                driver_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DriverUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "address": "Bole, Woreda 03",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "full_name": "Dawit Alemu",
                     *       "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *       "is_active": true,
                     *       "phone": "+251911000201",
                     *       "plate": "AA 3-B12345",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["DriverRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Driver Assigned, Driver Exists, Plate Taken */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    offers_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                offer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-11-14T09:15:00Z",
                     *       "expires_at": "2026-11-16T09:15:00Z",
                     *       "id": "5abe6c7d-9b8f-4e0d-8f3a-6b7c8d9e0f01",
                     *       "request_id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "rider_id": null,
                     *       "rider_name": "Meron Haile",
                     *       "route_code": "CMC-BOLE-1",
                     *       "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "skip_reason": null,
                     *       "sms_status": "sent",
                     *       "start_date": "2026-12-01",
                     *       "status": "open",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["OfferRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    offers_accept: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path: {
                offer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-11-14T09:15:00Z",
                     *       "expires_at": "2026-11-16T09:15:00Z",
                     *       "id": "5abe6c7d-9b8f-4e0d-8f3a-6b7c8d9e0f01",
                     *       "request_id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "rider_id": null,
                     *       "rider_name": "Meron Haile",
                     *       "route_code": "CMC-BOLE-1",
                     *       "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "skip_reason": null,
                     *       "sms_status": "sent",
                     *       "start_date": "2026-12-01",
                     *       "status": "open",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["OfferRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Offer Closed, Request In Progress, Rider Exists, Rider Has Seat, Route Full */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    offers_withdraw: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                offer_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-11-14T09:15:00Z",
                     *       "expires_at": "2026-11-16T09:15:00Z",
                     *       "id": "5abe6c7d-9b8f-4e0d-8f3a-6b7c8d9e0f01",
                     *       "request_id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "rider_id": null,
                     *       "rider_name": "Meron Haile",
                     *       "route_code": "CMC-BOLE-1",
                     *       "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "skip_reason": null,
                     *       "sms_status": "sent",
                     *       "start_date": "2026-12-01",
                     *       "status": "open",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["OfferRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Offer Closed */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    overview_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "as_of": "2026-11-15",
                     *       "drivers": {
                     *         "active": 13
                     *       },
                     *       "riders": {
                     *         "reserved": 24,
                     *         "riding": 150,
                     *         "total": 180
                     *       },
                     *       "route_requests": {
                     *         "open": 9
                     *       },
                     *       "routes": {
                     *         "active": 12,
                     *         "active_without_driver": 1,
                     *         "draft": 1,
                     *         "forming": 3,
                     *         "paused": 0,
                     *         "ready_to_launch": 2
                     *       },
                     *       "seat_offers": {
                     *         "open": 2
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["Overview"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    public_areas_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                q?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["PublicAreaPage"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    public_offers_accept: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path: {
                offer_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PublicOfferAccept"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "route_code": "CMC-BOLE-1",
                     *       "start_date": "2026-12-01",
                     *       "status": "accepted"
                     *     }
                     */
                    "application/json": components["schemas"]["PublicOfferAccepted"];
                };
            };
            /** @description Phone Not Verified */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Offer Closed, Request In Progress, Rider Exists, Rider Has Seat, Route Full */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    public_routes_list: {
        parameters: {
            query: {
                limit?: number;
                cursor?: string | null;
                from_area_id: string;
                to_area_id: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "code": "CMC-BOLE-1",
                     *           "destination_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *             "name": "Bole"
                     *           },
                     *           "full": false,
                     *           "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *           "morning_arrival_time": "07:20",
                     *           "morning_time": "06:30",
                     *           "origin_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *             "name": "CMC"
                     *           },
                     *           "prices": {
                     *             "one_way": 1800,
                     *             "round_trip": 3200,
                     *             "saturday": 600
                     *           },
                     *           "return_arrival_time": "18:30",
                     *           "return_time": "17:30",
                     *           "served_areas": [
                     *             {
                     *               "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *               "name": "Megenagna"
                     *             }
                     *           ],
                     *           "status": "active"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["PublicRoutePage"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    registrations_adult: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AdultRegistration"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "outcome": "reserved",
                     *       "rider_id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *       "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "route_request_id": null,
                     *       "start_date": "2026-12-01"
                     *     }
                     */
                    "application/json": components["schemas"]["AdultRegistered"];
                };
            };
            /** @description Phone Not Verified */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Request In Progress, Rider Exists, Route Full, Route Request Exists */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                q?: string | null;
                rider_type?: components["schemas"]["gize_api__riders__models__RiderType"] | null;
                seat?: components["schemas"]["SeatState"] | null;
                route_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "company": null,
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "destination_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *             "name": "Bole"
                     *           },
                     *           "full_name": "Selam Tesfaye",
                     *           "home_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *             "name": "CMC"
                     *           },
                     *           "id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *           "next_seat": null,
                     *           "open_requests": 0,
                     *           "phone_masked": "+2519****0123",
                     *           "plan": "round_trip",
                     *           "rider_type": "adult",
                     *           "saturday_addon": false,
                     *           "seat": {
                     *             "end_date": null,
                     *             "route_code": "CMC-BOLE-1",
                     *             "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *             "start_date": "2026-11-01",
                     *             "status": "active"
                     *           },
                     *           "source": "staff",
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["RiderPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RiderCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new rider. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "company": null,
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "full_name": "Selam Tesfaye",
                     *       "home_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *       "next_seat": null,
                     *       "open_requests": 0,
                     *       "phone": "+251911000123",
                     *       "plan": "round_trip",
                     *       "rider_type": "adult",
                     *       "saturday_addon": false,
                     *       "seat": {
                     *         "end_date": null,
                     *         "route_code": "CMC-BOLE-1",
                     *         "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *         "start_date": "2026-11-01",
                     *         "status": "active"
                     *       },
                     *       "source": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RiderRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Request In Progress, Rider Exists */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_lookup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RiderLookup"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "company": null,
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "destination_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *             "name": "Bole"
                     *           },
                     *           "full_name": "Selam Tesfaye",
                     *           "home_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *             "name": "CMC"
                     *           },
                     *           "id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *           "next_seat": null,
                     *           "open_requests": 0,
                     *           "phone_masked": "+2519****0123",
                     *           "plan": "round_trip",
                     *           "rider_type": "adult",
                     *           "saturday_addon": false,
                     *           "seat": {
                     *             "end_date": null,
                     *             "route_code": "CMC-BOLE-1",
                     *             "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *             "start_date": "2026-11-01",
                     *             "status": "active"
                     *           },
                     *           "source": "staff",
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": components["schemas"]["RiderMatches"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rider_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "company": null,
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "full_name": "Selam Tesfaye",
                     *       "home_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *       "next_seat": null,
                     *       "open_requests": 0,
                     *       "phone": "+251911000123",
                     *       "plan": "round_trip",
                     *       "rider_type": "adult",
                     *       "saturday_addon": false,
                     *       "seat": {
                     *         "end_date": null,
                     *         "route_code": "CMC-BOLE-1",
                     *         "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *         "start_date": "2026-11-01",
                     *         "status": "active"
                     *       },
                     *       "source": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RiderRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rider_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Rider Has Seat */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                rider_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RiderUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "company": null,
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "full_name": "Selam Tesfaye",
                     *       "home_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *       "next_seat": null,
                     *       "open_requests": 0,
                     *       "phone": "+251911000123",
                     *       "plan": "round_trip",
                     *       "rider_type": "adult",
                     *       "saturday_addon": false,
                     *       "seat": {
                     *         "end_date": null,
                     *         "route_code": "CMC-BOLE-1",
                     *         "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *         "start_date": "2026-11-01",
                     *         "status": "active"
                     *       },
                     *       "source": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RiderRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Rider Exists */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_place: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path: {
                rider_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SeatPlacement"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "company": null,
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "full_name": "Selam Tesfaye",
                     *       "home_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *       "next_seat": null,
                     *       "open_requests": 0,
                     *       "phone": "+251911000123",
                     *       "plan": "round_trip",
                     *       "rider_type": "adult",
                     *       "saturday_addon": false,
                     *       "seat": {
                     *         "end_date": null,
                     *         "route_code": "CMC-BOLE-1",
                     *         "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *         "start_date": "2026-11-01",
                     *         "status": "active"
                     *       },
                     *       "source": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RiderRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Already On Route, Request In Progress, Rider Moving, Route Full, Route Has Waiting Requests, Route Not Ready */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    riders_end_seat: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path: {
                rider_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SeatEnd"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "company": null,
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "destination_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *         "name": "Bole"
                     *       },
                     *       "full_name": "Selam Tesfaye",
                     *       "home_area": {
                     *         "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *         "name": "CMC"
                     *       },
                     *       "id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *       "next_seat": null,
                     *       "open_requests": 0,
                     *       "phone": "+251911000123",
                     *       "plan": "round_trip",
                     *       "rider_type": "adult",
                     *       "saturday_addon": false,
                     *       "seat": {
                     *         "end_date": null,
                     *         "route_code": "CMC-BOLE-1",
                     *         "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *         "start_date": "2026-11-01",
                     *         "status": "active"
                     *       },
                     *       "source": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RiderRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Request In Progress, Rider Has No Seat */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    route_requests_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                status?: components["schemas"]["RequestStatus"] | null;
                kind?: components["schemas"]["RequestKind"] | null;
                open?: boolean | null;
                route_id?: string | null;
                /** @description A listed area at A. */
                from_area_id?: string | null;
                /** @description An area typed as not listed at A, ignoring case. */
                from_area_name?: string | null;
                /** @description A listed area at B. */
                to_area_id?: string | null;
                /** @description An area typed as not listed at B, ignoring case. */
                to_area_name?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "contact_name": "Meron Haile",
                     *           "contact_phone": "+251911000124",
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "decline_reason": null,
                     *           "from_area": null,
                     *           "from_area_name": null,
                     *           "id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *           "kind": "route",
                     *           "matched_route": null,
                     *           "notes": null,
                     *           "preferred_morning_time": null,
                     *           "preferred_return_time": null,
                     *           "rider_name": "Meron Haile",
                     *           "rider_type": "adult",
                     *           "route": {
                     *             "code": "CMC-BOLE-1",
                     *             "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01"
                     *           },
                     *           "school_name": null,
                     *           "source": "app",
                     *           "status": "new",
                     *           "to_area": null,
                     *           "to_area_name": null,
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRequestPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    route_requests_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteRequestCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new request. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "contact_name": "Meron Haile",
                     *       "contact_phone": "+251911000124",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "decline_reason": null,
                     *       "from_area": null,
                     *       "from_area_name": null,
                     *       "id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "kind": "route",
                     *       "matched_route": null,
                     *       "notes": null,
                     *       "preferred_morning_time": null,
                     *       "preferred_return_time": null,
                     *       "rider_name": "Meron Haile",
                     *       "rider_type": "adult",
                     *       "route": {
                     *         "code": "CMC-BOLE-1",
                     *         "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01"
                     *       },
                     *       "school_name": null,
                     *       "source": "app",
                     *       "status": "new",
                     *       "to_area": null,
                     *       "to_area_name": null,
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRequestRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Request In Progress, Route Request Exists */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    route_requests_summary: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "area_pairs": [
                     *         {
                     *           "from_area": {
                     *             "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *             "name": "CMC"
                     *           },
                     *           "from_area_name": null,
                     *           "open": 2,
                     *           "to_area": null,
                     *           "to_area_name": "Kality"
                     *         }
                     *       ],
                     *       "area_pairs_truncated": false,
                     *       "routes": [
                     *         {
                     *           "open": 3,
                     *           "route": {
                     *             "code": "CMC-BOLE-1",
                     *             "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01"
                     *           },
                     *           "seats_free_next_month": 1,
                     *           "status": "active"
                     *         }
                     *       ],
                     *       "routes_truncated": false
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRequestSummary"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    route_requests_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "contact_name": "Meron Haile",
                     *       "contact_phone": "+251911000124",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "decline_reason": null,
                     *       "from_area": null,
                     *       "from_area_name": null,
                     *       "id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "kind": "route",
                     *       "matched_route": null,
                     *       "notes": null,
                     *       "preferred_morning_time": null,
                     *       "preferred_return_time": null,
                     *       "rider_name": "Meron Haile",
                     *       "rider_type": "adult",
                     *       "route": {
                     *         "code": "CMC-BOLE-1",
                     *         "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01"
                     *       },
                     *       "school_name": null,
                     *       "source": "app",
                     *       "status": "new",
                     *       "to_area": null,
                     *       "to_area_name": null,
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRequestRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    route_requests_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    route_requests_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteRequestUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "contact_name": "Meron Haile",
                     *       "contact_phone": "+251911000124",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "decline_reason": null,
                     *       "from_area": null,
                     *       "from_area_name": null,
                     *       "id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "kind": "route",
                     *       "matched_route": null,
                     *       "notes": null,
                     *       "preferred_morning_time": null,
                     *       "preferred_return_time": null,
                     *       "rider_name": "Meron Haile",
                     *       "rider_type": "adult",
                     *       "route": {
                     *         "code": "CMC-BOLE-1",
                     *         "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01"
                     *       },
                     *       "school_name": null,
                     *       "source": "app",
                     *       "status": "new",
                     *       "to_area": null,
                     *       "to_area_name": null,
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRequestRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Route Request Exists */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    route_requests_set_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                request_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteRequestStatusSet"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "contact_name": "Meron Haile",
                     *       "contact_phone": "+251911000124",
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "decline_reason": null,
                     *       "from_area": null,
                     *       "from_area_name": null,
                     *       "id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "kind": "route",
                     *       "matched_route": null,
                     *       "notes": null,
                     *       "preferred_morning_time": null,
                     *       "preferred_return_time": null,
                     *       "rider_name": "Meron Haile",
                     *       "rider_type": "adult",
                     *       "route": {
                     *         "code": "CMC-BOLE-1",
                     *         "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01"
                     *       },
                     *       "school_name": null,
                     *       "source": "app",
                     *       "status": "new",
                     *       "to_area": null,
                     *       "to_area_name": null,
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRequestRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Status Change */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                q?: string | null;
                route_type?: components["schemas"]["RouteType"] | null;
                status?: components["schemas"]["RouteStatus"] | null;
                corridor_id?: string | null;
                company_id?: string | null;
                /** @description Routes this driver drives. */
                driver_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "code": "CMC-BOLE-1",
                     *           "company": null,
                     *           "copied_from_route_id": null,
                     *           "corridor": {
                     *             "destination_area": {
                     *               "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *               "name": "Bole"
                     *             },
                     *             "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *             "origin_area": {
                     *               "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *               "name": "CMC"
                     *             }
                     *           },
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "driver": {
                     *             "full_name": "Dawit Alemu",
                     *             "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *             "plate": "AA 3-B12345"
                     *           },
                     *           "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *           "launch_minimum": 10,
                     *           "morning_arrival_time": "07:20",
                     *           "morning_time": "06:30",
                     *           "prices": {
                     *             "one_way": 1800,
                     *             "round_trip": 3200,
                     *             "saturday": 600
                     *           },
                     *           "reserved": 0,
                     *           "return_arrival_time": "18:30",
                     *           "return_time": "17:30",
                     *           "route_type": "public",
                     *           "school_name": null,
                     *           "seats": 14,
                     *           "seats_free": {
                     *             "next_month": 1,
                     *             "this_month": 2
                     *           },
                     *           "seats_taken": {
                     *             "next_month": 13,
                     *             "this_month": 12
                     *           },
                     *           "served_areas": [
                     *             {
                     *               "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *               "name": "Megenagna"
                     *             }
                     *           ],
                     *           "status": "active",
                     *           "status_changes": [
                     *             {
                     *               "blocked_by": [],
                     *               "launch_date": null,
                     *               "ready": true,
                     *               "to": "paused"
                     *             }
                     *           ],
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["RoutePage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new route. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Request In Progress, Route Code Taken */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Route Has Requests, Route Has Riders */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Driver Busy, Route Code Taken, Route Has Prices, Route Has Requests, Route Has Riders, Seats Below Launch Minimum, Seats Below Taken */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_set_areas: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteAreasSet"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Route Has Riders */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_copy: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteCopy"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new route. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Request In Progress, Route Code Taken, Route Not Ready */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_set_driver: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteDriverSet"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Driver Busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_launch_messages: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "failed": 1,
                     *       "launch_date": "2026-12-01",
                     *       "pending": 0,
                     *       "riders": [
                     *         {
                     *           "attempts": 3,
                     *           "full_name": "Selam Tesfaye",
                     *           "rider_id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *           "start_date": "2026-12-01",
                     *           "status": "failed"
                     *         }
                     *       ],
                     *       "sending": 0,
                     *       "sent": 1,
                     *       "total": 2,
                     *       "unconfirmed": 0
                     *     }
                     */
                    "application/json": components["schemas"]["LaunchMessages"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_retry_launch_messages: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "failed": 1,
                     *       "launch_date": "2026-12-01",
                     *       "pending": 0,
                     *       "riders": [
                     *         {
                     *           "attempts": 3,
                     *           "full_name": "Selam Tesfaye",
                     *           "rider_id": "3e9c4a5b-7f6d-4c8b-8d1e-4f5a6b7c8d01",
                     *           "start_date": "2026-12-01",
                     *           "status": "failed"
                     *         }
                     *       ],
                     *       "sending": 0,
                     *       "sent": 1,
                     *       "total": 2,
                     *       "unconfirmed": 0
                     *     }
                     */
                    "application/json": components["schemas"]["LaunchMessages"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Request In Progress */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_launch_months: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "launch_minimum": 10,
                     *       "months": [
                     *         {
                     *           "launch_date": "2026-12-01",
                     *           "ready": true,
                     *           "reserved": 11
                     *         },
                     *         {
                     *           "launch_date": "2027-01-01",
                     *           "ready": true,
                     *           "reserved": 11
                     *         }
                     *       ],
                     *       "status": "forming"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteLaunchMonths"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    offers_queue: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
            };
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "not_offerable": null,
                     *           "offered_before": false,
                     *           "position": 1,
                     *           "request": {
                     *             "contact_name": "Meron Haile",
                     *             "contact_phone": "+251911000124",
                     *             "created_at": "2026-10-01T06:30:00Z",
                     *             "decline_reason": null,
                     *             "from_area": null,
                     *             "from_area_name": null,
                     *             "id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *             "kind": "route",
                     *             "matched_route": null,
                     *             "notes": null,
                     *             "preferred_morning_time": null,
                     *             "preferred_return_time": null,
                     *             "rider_name": "Meron Haile",
                     *             "rider_type": "adult",
                     *             "route": {
                     *               "code": "CMC-BOLE-1",
                     *               "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01"
                     *             },
                     *             "school_name": null,
                     *             "source": "app",
                     *             "status": "new",
                     *             "to_area": null,
                     *             "to_area_name": null,
                     *             "updated_at": "2026-11-14T09:15:00Z"
                     *           }
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["OfferQueuePage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    offers_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
            };
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "created_at": "2026-11-14T09:15:00Z",
                     *           "expires_at": "2026-11-16T09:15:00Z",
                     *           "id": "5abe6c7d-9b8f-4e0d-8f3a-6b7c8d9e0f01",
                     *           "request_id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *           "rider_id": null,
                     *           "rider_name": "Meron Haile",
                     *           "route_code": "CMC-BOLE-1",
                     *           "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *           "skip_reason": null,
                     *           "sms_status": "sent",
                     *           "start_date": "2026-12-01",
                     *           "status": "open",
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["OfferPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    offers_create: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OfferCreate"];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    /** @description The new offer. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-11-14T09:15:00Z",
                     *       "expires_at": "2026-11-16T09:15:00Z",
                     *       "id": "5abe6c7d-9b8f-4e0d-8f3a-6b7c8d9e0f01",
                     *       "request_id": "4fad5b6c-8a7e-4d9c-9e2f-5a6b7c8d9e01",
                     *       "rider_id": null,
                     *       "rider_name": "Meron Haile",
                     *       "route_code": "CMC-BOLE-1",
                     *       "route_id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "skip_reason": null,
                     *       "sms_status": "sent",
                     *       "start_date": "2026-12-01",
                     *       "status": "open",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["OfferRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description No Waiting Requests, Offer Open, Request In Progress, Route Full, Route Has Waiting Requests, Route Not Ready */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_set_prices: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RoutePricesSet"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Route Has No Prices, Route Has Riders */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    routes_set_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                route_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteStatusSet"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": "CMC-BOLE-1",
                     *       "company": null,
                     *       "copied_from_route_id": null,
                     *       "corridor": {
                     *         "destination_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a02",
                     *           "name": "Bole"
                     *         },
                     *         "id": "1c7a2e3f-5d4b-4a6f-8b9c-2d3e4f5a6b01",
                     *         "origin_area": {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a01",
                     *           "name": "CMC"
                     *         }
                     *       },
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "driver": {
                     *         "full_name": "Dawit Alemu",
                     *         "id": "6bcf7d8e-0c9a-4f1e-9a4b-7c8d9e0f1a01",
                     *         "plate": "AA 3-B12345"
                     *       },
                     *       "id": "2d8b3f4a-6e5c-4b7a-9c0d-3e4f5a6b7c01",
                     *       "launch_minimum": 10,
                     *       "morning_arrival_time": "07:20",
                     *       "morning_time": "06:30",
                     *       "prices": {
                     *         "one_way": 1800,
                     *         "round_trip": 3200,
                     *         "saturday": 600
                     *       },
                     *       "reserved": 0,
                     *       "return_arrival_time": "18:30",
                     *       "return_time": "17:30",
                     *       "route_type": "public",
                     *       "school_name": null,
                     *       "seats": 14,
                     *       "seats_free": {
                     *         "next_month": 1,
                     *         "this_month": 2
                     *       },
                     *       "seats_taken": {
                     *         "next_month": 13,
                     *         "this_month": 12
                     *       },
                     *       "served_areas": [
                     *         {
                     *           "id": "0b6f1d2e-4c3a-4f5e-9a8b-1c2d3e4f5a03",
                     *           "name": "Megenagna"
                     *         }
                     *       ],
                     *       "status": "active",
                     *       "status_changes": [
                     *         {
                     *           "blocked_by": [],
                     *           "launch_date": null,
                     *           "ready": true,
                     *           "to": "paused"
                     *         }
                     *       ],
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["RouteRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Status Change, Not Enough Riders, Route Has Riders, Route Not Ready */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    staff_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                role?: components["schemas"]["StaffRole"] | null;
                is_active?: boolean | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "items": [
                     *         {
                     *           "created_at": "2026-10-01T06:30:00Z",
                     *           "email": "operations@example.com",
                     *           "first_signed_in_at": "2026-10-01T06:30:00Z",
                     *           "full_name": "Tigist Mengistu",
                     *           "id": "7cd08e9f-1dab-4a2f-8b5c-8d9e0f1a2b01",
                     *           "is_active": true,
                     *           "role": "staff",
                     *           "updated_at": "2026-11-14T09:15:00Z"
                     *         }
                     *       ],
                     *       "next_cursor": null
                     *     }
                     */
                    "application/json": components["schemas"]["StaffPage"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Invalid Cursor, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    staff_invite: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StaffInvite"];
            };
        };
        responses: {
            /** @description Invited */
            201: {
                headers: {
                    /** @description Present on a retry answered with the stored response. */
                    "Idempotent-Replayed"?: "true";
                    /** @description The new member: `/v1/staff/{id}`. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "email": "operations@example.com",
                     *       "first_signed_in_at": "2026-10-01T06:30:00Z",
                     *       "full_name": "Tigist Mengistu",
                     *       "id": "7cd08e9f-1dab-4a2f-8b5c-8d9e0f1a2b01",
                     *       "is_active": true,
                     *       "role": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["StaffRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Email Already Used By Staff, Request In Progress, Sign-In Account Already Exists */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    staff_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "email": "operations@example.com",
                     *       "full_name": "Tigist Mengistu",
                     *       "id": "7cd08e9f-1dab-4a2f-8b5c-8d9e0f1a2b01",
                     *       "role": "staff"
                     *     }
                     */
                    "application/json": components["schemas"]["StaffMe"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    staff_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                staff_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "email": "operations@example.com",
                     *       "first_signed_in_at": "2026-10-01T06:30:00Z",
                     *       "full_name": "Tigist Mengistu",
                     *       "id": "7cd08e9f-1dab-4a2f-8b5c-8d9e0f1a2b01",
                     *       "is_active": true,
                     *       "role": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["StaffRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    staff_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                staff_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StaffUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "created_at": "2026-10-01T06:30:00Z",
                     *       "email": "operations@example.com",
                     *       "first_signed_in_at": "2026-10-01T06:30:00Z",
                     *       "full_name": "Tigist Mengistu",
                     *       "id": "7cd08e9f-1dab-4a2f-8b5c-8d9e0f1a2b01",
                     *       "is_active": true,
                     *       "role": "staff",
                     *       "updated_at": "2026-11-14T09:15:00Z"
                     *     }
                     */
                    "application/json": components["schemas"]["StaffRead"];
                };
            };
            /** @description Unauthenticated */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not Found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Last Active Admin */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    verification_request: {
        parameters: {
            query?: never;
            header: {
                /** @description One per user action, reused on every retry of it (api-contract.md). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "expires_at": "2026-11-15T09:25:00Z",
                     *       "verification_id": "9ef2a0b1-3fcd-4c4b-8d7e-0f1a2b3c4d01"
                     *     }
                     */
                    "application/json": components["schemas"]["VerificationSent"];
                };
            };
            /** @description Request In Progress */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Mismatch, Validation Failed */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Idempotency Key Required */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description SMS Unavailable, Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    verification_verify: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationCheck"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "expires_at": "2026-11-15T09:50:00Z",
                     *       "verified_phone_token": "example.example.example"
                     *     }
                     */
                    "application/json": components["schemas"]["PhoneVerified"];
                };
            };
            /** @description Verification Expired */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payload Too Large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Validation Failed, Verification Code Invalid */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ValidationProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description Too Many Requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Internal Server Error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
}
