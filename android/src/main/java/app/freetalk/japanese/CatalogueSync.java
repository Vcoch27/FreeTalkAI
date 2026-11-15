package app.freetalk.japanese;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

import javax.net.ssl.HttpsURLConnection;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class CatalogueSync {
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final long REFRESH_INTERVAL = 15 * 60 * 1000L;

    static void refresh(Context context) {
        refresh(context, () -> {});
    }

    static void refresh(Context context, Runnable complete) {
        Context app = context.getApplicationContext();
        executor.execute(() -> {
            try { sync(app); }
            finally { complete.run(); }
        });
    }

    private static void sync(Context app) {
        SharedPreferences state = new PromptStore(app).state;
        long now = System.currentTimeMillis();
        long last = state.getLong("catalogue_sync", 0);
        if (now >= last && now - last < REFRESH_INTERVAL) return;
        HttpsURLConnection connection = null;
        try {
            connection = (HttpsURLConnection) new URL(BuildConfig.CATALOGUE_URL).openConnection();
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(4000);
            connection.setInstanceFollowRedirects(false);
            if (connection.getResponseCode() != 200) return;
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[4096];
                int count;
                while ((count = input.read(chunk)) != -1) {
                    if (buffer.size() + count > 256 * 1024) return;
                    buffer.write(chunk, 0, count);
                }
                String raw = new String(buffer.toByteArray(), StandardCharsets.UTF_8);
                JSONObject data = new JSONObject(raw);
                if (data.getJSONArray("entries").length() == 0) return;
                java.time.OffsetDateTime.parse(data.getString("validUntil"));
                state.edit().putString("discussion_schedule", raw)
                        .putLong("catalogue_sync", now).apply();
            }
        } catch (java.io.IOException | org.json.JSONException ignored) {
            // Keep the last successful cache when the endpoint is unavailable.
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
