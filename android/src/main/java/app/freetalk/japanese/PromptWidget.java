package app.freetalk.japanese;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

public final class PromptWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        PromptAlarm.refresh(context, false);
        PromptAlarm.schedule(context);
        update(context, manager, ids);
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        update(context, manager, manager.getAppWidgetIds(new ComponentName(context, PromptWidget.class)));
    }

    private static void update(Context context, AppWidgetManager manager, int[] ids) {
        if (ids.length == 0) return;
        PromptStore store = new PromptStore(context);
        PromptStore.Prompt prompt = store.current();
        if (store.entry(java.time.Instant.now(), false) == null) {
            RemoteViews placeholder = new RemoteViews(context.getPackageName(), R.layout.prompt_widget);
            placeholder.setTextViewText(R.id.widget_ja, "FreeTalk 日本語");
            placeholder.setTextViewText(R.id.widget_vi, "Mở app để đồng bộ");
            Intent launch = new Intent(context, MainActivity.class);
            placeholder.setOnClickPendingIntent(R.id.widget_root,
                    PendingIntent.getActivity(context, 1, launch, PendingIntent.FLAG_IMMUTABLE));
            manager.updateAppWidget(ids, placeholder);
            return;
        }
        String slot = PromptAlarm.currentSlot(store);
        java.time.ZonedDateTime local = java.time.Instant.parse(slot).atZone(java.time.ZoneId.systemDefault());
        RemoteViews layout = new RemoteViews(context.getPackageName(), R.layout.prompt_widget);
        layout.setTextViewText(R.id.widget_time, local.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm · dd/MM")));
        layout.setTextViewText(R.id.widget_ja, prompt.ja());
        layout.setTextViewText(R.id.widget_vi, prompt.vi());
        layout.setViewVisibility(R.id.widget_vi, store.state.getBoolean("translation", true) ? View.VISIBLE : View.GONE);
        layout.setOnClickPendingIntent(R.id.widget_root, openQuestion(context, prompt, slot));
        manager.updateAppWidget(ids, layout);
    }

    static PendingIntent openQuestion(Context context, PromptStore.Prompt prompt, String slot) {
        Intent intent = new Intent(context, MainActivity.class)
                .setData(android.net.Uri.parse("freetalk://question/" + prompt.id() + "?slot=" + slot))
                .putExtra("slot", slot)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try { intent.putExtra("snapshot", prompt.json().toString()); }
        catch (org.json.JSONException error) { throw new IllegalStateException(error); }
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
