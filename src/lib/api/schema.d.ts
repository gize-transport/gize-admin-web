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
         *     case.
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
        /** One area */
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
         *     changes nothing.
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
        /** One company */
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
        /** One corridor */
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
         *     or doesn't fit is a 422 on its field.
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
        /** One route request */
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
        /** One route */
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
        /** One staff member (admins only) */
        get: operations["staff_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Change a staff member's role or status (admins only)
         * @description Promote, demote, deactivate or reactivate. No Idempotency-Key: setting a value that
         *     is already there changes nothing.
         *
         *     - 409 LAST_ACTIVE_ADMIN: the change would leave no active admin.
         */
        patch: operations["staff_update"];
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
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
         * ErrorCode
         * @description Stable error codes: never rename or reuse one; only add.
         * @enum {string}
         */
        ErrorCode: "BAD_REQUEST" | "CORS_PREFLIGHT_REJECTED" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "PAYLOAD_TOO_LARGE" | "VALIDATION_FAILED" | "INVALID_CURSOR" | "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENCY_KEY_MISMATCH" | "IDEMPOTENCY_IN_PROGRESS" | "RATE_LIMITED" | "STAFF_EMAIL_TAKEN" | "AUTH_ACCOUNT_EXISTS" | "LAST_ACTIVE_ADMIN" | "AREA_NAME_TAKEN" | "AREA_IN_USE" | "CORRIDOR_EXISTS" | "COMPANY_NAME_TAKEN" | "ROUTE_CODE_TAKEN" | "SEATS_BELOW_TAKEN" | "SEATS_BELOW_LAUNCH_MINIMUM" | "ROUTE_HAS_RIDERS" | "CORRIDOR_IN_USE" | "COMPANY_IN_USE" | "ROUTE_HAS_NO_PRICES" | "ROUTE_NOT_READY" | "NOT_ENOUGH_RIDERS" | "INVALID_STATUS_CHANGE" | "ROUTE_REQUEST_EXISTS" | "ROUTE_HAS_REQUESTS" | "ROUTE_HAS_PRICES" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE";
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
        /**
         * RiderType
         * @description Individual riders only: company riders come through their company.
         * @enum {string}
         */
        RiderType: "adult" | "student";
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
            rider_type: components["schemas"]["RiderType"];
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
            rider_type: components["schemas"]["RiderType"];
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
         *     someone locks them out on their next request; `is_active: true` reactivates them.
         */
        StaffUpdate: {
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
    route_requests_list: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string | null;
                status?: components["schemas"]["RequestStatus"] | null;
                kind?: components["schemas"]["RequestKind"] | null;
                open?: boolean | null;
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
            /** @description Route Code Taken, Route Has Prices, Route Has Requests, Route Has Riders, Seats Below Launch Minimum, Seats Below Taken */
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
            /** @description Route Has No Prices */
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
}
