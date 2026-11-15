package app.freetalk.japanese;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final String PAGE = "file:///android_asset/index.html";
    private WebView web;
    private PromptStore store;
    private volatile String linkedQuestion;
    private final android.content.SharedPreferences.OnSharedPreferenceChangeListener listener = (state, key) -> {
        if (("last_slot".equals(key) || "discussion_schedule".equals(key))) web.evaluateJavascript("window.dispatchEvent(new Event('freetalk-update'))", null);
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        store = new PromptStore(this);
        web = new WebView(this);
        web.setBackgroundColor(0xfff6f6f1);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setBlockNetworkLoads(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !PAGE.equals(request.getUrl().toString());
            }
        });
        web.addJavascriptInterface(new Bridge(), "FreeTalkAndroid");
        setContentView(web);
        open(getIntent());
    }

    @Override protected void onResume() {
        super.onResume();
        PromptAlarm.refresh(this, true);
        PromptAlarm.schedule(this);
        CatalogueSync.refresh(this, () -> runOnUiThread(() -> {
            PromptAlarm.refresh(this, true);
            PromptAlarm.schedule(this);
        }));
        store.state.registerOnSharedPreferenceChangeListener(listener);
        web.evaluateJavascript("window.dispatchEvent(new Event('freetalk-update'))", null);
    }

    @Override protected void onPause() {
        store.state.unregisterOnSharedPreferenceChangeListener(listener);
        super.onPause();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        open(intent);
    }

    private void open(Intent intent) {
        linkedQuestion = null;
        String slot = intent.getStringExtra("slot");
        String snapshot = intent.getStringExtra("snapshot");
        try {
            if (slot != null && snapshot != null && snapshot.length() <= 2000) {
                java.time.Instant.parse(slot);
                PromptStore.Prompt question = PromptStore.Prompt.parse(new org.json.JSONObject(snapshot));
                linkedQuestion = new org.json.JSONObject().put("question", question.json())
                        .put("slot", slot).toString();
            }
        } catch (org.json.JSONException | java.time.DateTimeException ignored) {
            // Fall back to the current question for invalid links.
        }
        web.loadUrl(PAGE + (linkedQuestion == null ? "" : "?history=1"));
    }

    private boolean askPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
            return true;
        }
        return false;
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if (request == 1 && testPending && grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) {
            PromptAlarm.notify(this, store.current(), PromptAlarm.currentSlot(store), true);
        }
        testPending = false;
    }

    private boolean testPending;
    private final class Bridge {
        @JavascriptInterface public String preferences() { return store.preferences(); }
        @JavascriptInterface public String discussionSchedule() { return store.discussionSchedule().toString(); }
        @JavascriptInterface public String linkedAssignment() { return linkedQuestion == null ? "null" : linkedQuestion; }
        @JavascriptInterface public boolean savePreferences(String values) {
            if (!store.savePreferences(values)) return false;
            runOnUiThread(() -> {
                PromptAlarm.refresh(MainActivity.this, false);
                PromptAlarm.schedule(MainActivity.this);
                PromptWidget.updateAll(MainActivity.this);
                if (store.state.getBoolean("enabled", false)) askPermission();
            });
            return true;
        }

        @JavascriptInterface public void testReminder() {
            runOnUiThread(() -> {
                testPending = askPermission();
                if (!testPending) PromptAlarm.notify(MainActivity.this, store.current(), PromptAlarm.currentSlot(store), true);
            });
        }
    }
}
