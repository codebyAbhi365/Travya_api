// import { supabase } from "../supabaseClient.js";

// export async function createReport(req, res) {
//   try {
//     const body = req.body || {};
//     const {
//       title = "",
//       description = "",
//       location = "",
//       reporter_fullname = "",
//       reporter_email = "",
//       reporter_phone = "",
//       wallet_address = null,
//       tourist_id = null,
//     } = body;

//     if (!title || !description) {
//       return res.status(400).json({ error: "Validation failed", details: "title and description are required" });
//     }

//     const row = {
//       title,
//       description,
//       location,
//       reporter_fullname,
//       reporter_email,
//       reporter_phone,
//       wallet_address,
//       tourist_id,
//     };

//     const { data, error } = await supabase
//       .from("reports")
//       .insert([row])
//       .select()
//       .single();
//     if (error) return res.status(500).json({ error: "Failed to save report", details: error.message });
//     return res.status(201).json({ report: data });
//   } catch (err) {
//     return res.status(500).json({ error: "Unexpected error", details: err.message });
//   }
// }

import { supabase } from "../supabaseClient.js";

export async function createReport(req, res) {
    try {
        // Simple role check placeholder: expect req.user.role === 'police'
        // Integrate with your actual auth middleware to populate req.user
        const role = req.user?.role || req.headers['x-user-role'];
        if (role !== 'police') {
            return res.status(403).json({ error: "Only police can create reports" });
        }

        const { areaName, description, latitude, longitude, reporterName, reporterPhone, radius_km, status_color } = req.body || {};
        if (!areaName || !description) {
            return res.status(400).json({ error: "areaName and description are required" });
        }
        const payload = {
            area_name: areaName,
            description,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            reporter_name: reporterName ?? null,
            reporter_phone: reporterPhone ?? null,
            radius_km: typeof radius_km === 'number' ? radius_km : (radius_km ? Number(radius_km) : null),
            status_color: status_color ?? null,
            created_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from("reports").insert([payload]).select();
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        return res.status(201).json({ report: Array.isArray(data) ? data[0] : data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}

export async function listReports(_req, res) {
    try {
        const { data, error } = await supabase
            .from("reports")
            .select("id, area_name, description, latitude, longitude, reporter_name, reporter_phone, radius_km, status_color, created_at")
            .order("created_at", { ascending: false })
            .limit(100);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        return res.json({ reports: data || [] });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}



