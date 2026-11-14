package app.freetalk.japanese;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

final class PromptStore {
    static final String START = "08:00";
    static final String END = "22:00";
    static final int INTERVAL = 120;

    record Prompt(String id, String mode, String ja, String vi) {
        JSONObject json() throws JSONException {
            return new JSONObject().put("id", id).put("mode", mode).put("ja", ja).put("vi", vi);
        }

        static Prompt parse(JSONObject item) throws JSONException {
            return new Prompt(item.getString("id"), item.getString("mode"), item.getString("ja"), item.getString("vi"));
        }
    }

    private static List<Prompt> catalog;
    private static final Random random = new Random();
    final SharedPreferences state;
    private final List<Prompt> prompts;

    PromptStore(Context context) {
        state = context.getSharedPreferences("freetalk", Context.MODE_PRIVATE);
        prompts = catalog(context);
    }

    private static synchronized List<Prompt> catalog(Context context) {
        if (catalog != null) return catalog;
        try (InputStream stream = context.getAssets().open("questions.js")) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int count;
            while ((count = stream.read(chunk)) != -1) buffer.write(chunk, 0, count);
            String source = new String(buffer.toByteArray(), StandardCharsets.UTF_8);
            JSONArray data = new JSONArray(source.substring(source.indexOf('['), source.lastIndexOf(']') + 1));
            List<Prompt> entries = new ArrayList<>();
            for (int i = 0; i < data.length(); i++) {
                JSONObject item = data.getJSONObject(i);
                entries.add(Prompt.parse(item));
            }
            catalog = entries;
            return catalog;
        } catch (IOException | JSONException e) {
            throw new IllegalStateException("Cannot read bundled questions", e);
        }
    }

    Prompt current() {
        String snapshot = state.getString("current_snapshot", "");
        if (!snapshot.isEmpty()) {
            try { return Prompt.parse(new JSONObject(snapshot)); }
            catch (JSONException ignored) { /* Use the bundled question if the snapshot is damaged. */ }
        }
        String id = state.getString("current", "");
        return prompts.stream().filter(prompt -> prompt.id().equals(id)).findFirst().orElse(prompts.get(0));
    }

    synchronized Prompt next(String slot) {
        Prompt current = current();
        List<String> recent = new ArrayList<>(java.util.Arrays.asList(state.getString("recent", "").split(",")));
        recent.remove(current.id());
        recent.add(0, current.id());
        if (recent.size() > 12) recent.subList(12, recent.size()).clear();
        List<Prompt> pool = new ArrayList<>();
        List<Prompt> available = new ArrayList<>(prompts);
        try {
            JSONArray remote = new JSONArray(state.getString("published_catalogue", "[]"));
            for (int i = 0; i < remote.length(); i++) available.add(Prompt.parse(remote.getJSONObject(i)));
        } catch (JSONException ignored) { /* The bundled questions still work. */ }
        for (Prompt prompt : available) {
            if (!recent.contains(prompt.id()) && !prompt.mode().equals(current.mode())) pool.add(prompt);
        }
        Prompt next = pool.get(random.nextInt(pool.size()));
        SharedPreferences.Editor edit = state.edit().putString("current", next.id()).putString("recent", String.join(",", recent));
        try { edit.putString("current_snapshot", next.json().toString()); }
        catch (JSONException error) { throw new IllegalStateException(error); }
        edit.putString("last_slot", slot);
        if (!edit.commit()) throw new IllegalStateException("Cannot save current question");
        return next;
    }

    String preferences() {
        try {
            return new JSONObject()
                    .put("translation", state.getBoolean("translation", true))
                    .put("enabled", state.getBoolean("enabled", false))
                    .put("interval", state.getInt("interval", INTERVAL))
                    .put("start", state.getString("start", START)).put("end", state.getString("end", END))
                    .toString();
        } catch (JSONException e) {
            throw new IllegalStateException(e);
        }
    }

    boolean savePreferences(String data) {
        try {
            JSONObject options = new JSONObject(data);
            int interval = options.getInt("interval");
            LocalTime start = LocalTime.parse(options.getString("start"));
            LocalTime end = LocalTime.parse(options.getString("end"));
            if (!start.isBefore(end) || !java.util.Arrays.asList(60, 120, 180, 240).contains(interval)) return false;
            return state.edit().putBoolean("translation", options.getBoolean("translation"))
                    .putBoolean("enabled", options.getBoolean("enabled")).putInt("interval", interval)
                    .putString("start", start.toString()).putString("end", end.toString()).commit();
        } catch (JSONException | java.time.DateTimeException e) {
            return false;
        }
    }
}
