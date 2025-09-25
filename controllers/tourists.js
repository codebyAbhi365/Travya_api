import { z } from "zod";
import { supabase } from "../supabaseClient.js";

const emergencyContactSchema = z.object({
    name: z.string().min(1),
    phoneNo: z.string().min(5),
    relationship: z.string().min(1)
});

const itineraryItemSchema = z.object({
    location: z.string().min(1),
    date: z.string().min(1),
    activity: z.string().min(1)
});

const touristSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    phoneNo: z.string().min(5),
    nationality: z.string().min(1),
    documentType: z.string().min(1),
    documentNo: z.string().min(1),
    registrationPoint: z.string().min(1),
    checkInDate: z.string().min(1),
    checkOutDate: z.string().min(1),
    emergencyContacts: z.array(emergencyContactSchema).min(1),
    travelItinerary: z.array(itineraryItemSchema).min(1),
    wallet_address: z.string().min(20).optional()
});

function bufferToFile(buffer, filename, mimetype) {
    return new File([buffer], filename, { type: mimetype });
}

export async function registerTourist(req, res) {
    try {
        const body = JSON.parse(req.body.data || "{}");
        const parsed = touristSchema.safeParse(body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
        }

        // Prevent duplicate registration by email
        const existing = await supabase
            .from('tourists')
            .select('id')
            .eq('email', parsed.data.email)
            .maybeSingle();
        if (existing?.data?.id) {
            return res.status(409).json({ error: 'A tourist with this email is already registered' });
        }

        const files = req.files || {};
        const photoFile = files.photo?.[0];
        const documentPhotoFile = files.documentPhoto?.[0];

        // Upload files to Supabase Storage if present
        let photoUrl = null;
        let documentPhotoUrl = null;
        if (photoFile) {
            const path = `photos/${Date.now()}_${photoFile.originalname}`;
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from("tourist-assets")
                .upload(path, photoFile.buffer, { contentType: photoFile.mimetype, upsert: false });
            if (uploadError) return res.status(500).json({ error: "Photo upload failed", details: uploadError.message });
            const { data: publicUrl } = supabase.storage.from("tourist-assets").getPublicUrl(uploadData.path);
            photoUrl = publicUrl.publicUrl;
        }

        if (documentPhotoFile) {
            const path = `documents/${Date.now()}_${documentPhotoFile.originalname}`;
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from("tourist-assets")
                .upload(path, documentPhotoFile.buffer, { contentType: documentPhotoFile.mimetype, upsert: false });
            if (uploadError) return res.status(500).json({ error: "Document photo upload failed", details: uploadError.message });
            const { data: publicUrl } = supabase.storage.from("tourist-assets").getPublicUrl(uploadData.path);
            documentPhotoUrl = publicUrl.publicUrl;
        }



        // Insert record into Supabase table
        // Your CREATE TABLE used unquoted identifiers. Postgres lowercases them.
        // So the actual column names are lowercase with no camelCase:
        // e.g., fullName -> fullname, checkInDate -> checkindate
        const safeRow = {
            fullname: parsed.data.fullName,
            email: parsed.data.email,
            phoneno: parsed.data.phoneNo,
            nationality: parsed.data.nationality,
            photo: photoUrl,
            documenttype: parsed.data.documentType,
            documentno: parsed.data.documentNo,
            documentphoto: documentPhotoUrl,
            registrationpoint: parsed.data.registrationPoint,
            checkindate: String(parsed.data.checkInDate).slice(0, 10),
            checkoutdate: String(parsed.data.checkOutDate).slice(0, 10),
            emergencycontacts: parsed.data.emergencyContacts,
            travelitinerary: parsed.data.travelItinerary,
            verified: false
        };

        let insertRes = await supabase
            .from("tourists")
            .insert([safeRow])
            .select()
            .single();
        if (insertRes.error && String(insertRes.error.message || '').includes("verified")) {
            // Retry without 'verified' column if schema not updated yet
            const { verified, ...noVerified } = safeRow;
            insertRes = await supabase
                .from("tourists")
                .insert([noVerified])
                .select()
                .single();
        }
        if (insertRes.error) {
            console.error("Supabase insert error:", insertRes.error);
            return res.status(500).json({ error: "Database insert failed", details: insertRes.error });
        }

        return res.status(201).json({ tourist: insertRes.data });
    } catch (err) {
        return res.status(500).json({ error: "Unexpected error", details: err.message });
    }
}

export async function listTourists(req, res) {
    try {
        let query = supabase
            .from('tourists')
            .select('id, created_at, fullname, email, phoneno, nationality, checkindate, checkoutdate, photo, documentno, documenttype, registrationpoint, verified')
            .order('created_at', { ascending: false });
        let { data, error } = await query;
        if (error) {
            // Fallback if 'verified' column doesn't exist yet
            if ((error.message || '').toLowerCase().includes('column') && (error.message || '').toLowerCase().includes('verified')) {
                const fallback = await supabase
                    .from('tourists')
                    .select('id, created_at, fullname, email, phoneno, nationality, checkindate, checkoutdate, photo, documentno')
                    .order('created_at', { ascending: false });
                if (fallback.error) return res.status(500).json({ error: 'Failed to fetch tourists', details: fallback.error.message });
                const withFlag = (fallback.data || []).map(t => ({ ...t, verified: false }));
                return res.json({ tourists: withFlag });
            }
            return res.status(500).json({ error: 'Failed to fetch tourists', details: error.message });
        }
        return res.json({ tourists: data });
    } catch (err) {
        return res.status(500).json({ error: 'Unexpected error', details: err.message });
    }
}

export async function getTouristById(req, res) {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('tourists')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return res.status(404).json({ error: 'Tourist not found', details: error.message });
        return res.json({ tourist: data });
    } catch (err) {
        return res.status(500).json({ error: 'Unexpected error', details: err.message });
    }
}

export async function getTouristByPassport(req, res) {
    try {
        const documentNo = String(req.params.documentNo || '').trim();
        let { data, error } = await supabase
            .from('tourists')
            .select('id, created_at, fullname, email, phoneno, nationality, photo, documenttype, documentno, registrationpoint, checkindate, checkoutdate, verified')
            .ilike('documentno', documentNo)
            .maybeSingle();
        // Fallback to case-sensitive equality if ilike not supported or errored
        if (error) {
            const fb = await supabase
                .from('tourists')
                .select('id, created_at, fullname, email, phoneno, nationality, photo, documenttype, documentno, registrationpoint, checkindate, checkoutdate, verified')
                .eq('documentno', documentNo)
                .maybeSingle();
            if (fb.error) {
                // Final fallback: batch fetch and normalize for comparison (ignoring spaces/dashes, case)
                const batch = await supabase
                    .from('tourists')
                    .select('id, created_at, fullname, email, phoneno, nationality, photo, documenttype, documentno, registrationpoint, checkindate, checkoutdate, verified')
                    .limit(500);
                if (batch.error) return res.status(500).json({ error: 'Lookup failed', details: batch.error.message });
                const norm = (s) => String(s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const target = norm(documentNo);
                const found = (batch.data || []).find(r => norm(r.documentno) === target);
                if (!found) return res.status(404).json({ error: 'No tourist found for this passport' });
                data = found;
            } else {
                data = fb.data;
            }
        }
        if (!data) return res.status(404).json({ error: 'No tourist found for this passport' });
        return res.json({ tourist: data });
    } catch (err) {
        return res.status(500).json({ error: 'Unexpected error', details: err.message });
    }
}

export async function verifyTouristByPassport(req, res) {
    try {
        const { id: rawId, documentNo: raw } = req.body || {};
        const idFromBody = rawId !== undefined && rawId !== null ? String(rawId) : null;
        const documentNo = String(raw || '').trim();
        if (!idFromBody && !documentNo) return res.status(400).json({ error: 'id or documentNo is required' });

        // Prefer updating by id if provided
        if (idFromBody) {
            const upd = await supabase
                .from('tourists')
                .update({ verified: true })
                .eq('id', idFromBody)
                .select('id, fullname, documentno, verified')
                .single();
            if (upd.error) return res.status(500).json({ error: 'Verification failed', details: upd.error.message });
            return res.json({ tourist: upd.data });
        }

        // Otherwise try to find by document number (robust matching)
        let find = await supabase
            .from('tourists')
            .select('id, fullname, documentno, verified')
            .ilike('documentno', documentNo)
            .limit(1)
            .maybeSingle();
        if (find.error) {
            // Fallback to case-sensitive equality
            const fb = await supabase
                .from('tourists')
                .select('id, fullname, documentno, verified')
                .eq('documentno', documentNo)
                .limit(1)
                .maybeSingle();
            if (fb.error) {
                // Final fallback: batch and normalize
                const batch = await supabase
                    .from('tourists')
                    .select('id, fullname, documentno, verified')
                    .limit(500);
                if (batch.error) return res.status(500).json({ error: 'Lookup failed', details: batch.error.message });
                const norm = (s) => String(s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const target = norm(documentNo);
                const targetRow = (batch.data || []).find(r => norm(r.documentno) === target);
                if (!targetRow) return res.status(404).json({ error: 'No tourist found for this passport' });
                find = { data: targetRow };
            } else {
                find = fb;
            }
        }
        if (!find.data) return res.status(404).json({ error: 'No tourist found for this passport' });
        const id = find.data.id;
        const upd = await supabase
            .from('tourists')
            .update({ verified: true })
            .eq('id', id)
            .select('id, fullname, documentno, verified')
            .single();
        if (upd.error) return res.status(500).json({ error: 'Verification failed', details: upd.error.message });
        return res.json({ tourist: upd.data });
    } catch (err) {
        return res.status(500).json({ error: 'Unexpected error', details: err.message });
    }
}


