import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = "https://bdvyohjudxyvahicqxsj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkdnlvaGp1ZHh5dmFoaWNxeHNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODcwNDA3MSwiZXhwIjoyMDc0MjgwMDcxfQ.LRn4G-z4Szv5D8lUMshRZryKtwolKfTlIWNw2nO9nM4";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Supabase env vars missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

// Ensure storage bucket exists (idempotent)
async function ensureBuckets() {
    try {
        const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
        if (listErr) {
            console.warn("Supabase listBuckets failed:", listErr.message);
            console.warn("Hint: Ensure SUPABASE_SERVICE_ROLE_KEY is set (not ANON key).");
            return;
        }
        const exists = (buckets || []).some(b => b.name === "tourist-assets");
        if (!exists) {
            const { error: createErr } = await supabase.storage.createBucket("tourist-assets", { public: true });
            if (createErr) {
                console.warn("Could not create bucket 'tourist-assets':", createErr.message);
            } else {
                console.log("Created Supabase bucket 'tourist-assets'.");
            }
        }
    } catch (e) {
        // Non-fatal
        console.warn("Could not ensure Supabase storage bucket:", e.message);
    }
}

ensureBuckets();


