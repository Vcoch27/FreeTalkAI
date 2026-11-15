package app.freetalk.japanese;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.RelativeSizeSpan;

import java.time.LocalTime;
import java.time.Instant;
import java.time.Duration;

public final class PromptAlarm extends BroadcastReceiver {
    private static final String TICK = "app.freetalk.japanese.TICK";
    private static final String CHANNEL = "practice_voice";

    @Override public void onReceive(Context context, Intent intent) {
        boolean tick = TICK.equals(intent.getAction());
        refresh(context, tick);
        schedule(context);
        PendingResult result = goAsync();
        CatalogueSync.refresh(context, () ->
                new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> {
                    try { refresh(context, tick); schedule(context); }
                    finally { result.finish(); }
                }));
    }

    static void schedule(Context context) {
        PromptStore store = new PromptStore(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent alarm = PendingIntent.getBroadcast(context, 0,
                new Intent(context, PromptAlarm.class).setAction(TICK), PendingIntent.FLAG_IMMUTABLE);
        Instant now = Instant.now();
        org.json.JSONObject entry = store.entry(now, true);
        Instant next = entry == null ? now.plus(Duration.ofMinutes(15)) : Instant.parse(entry.optString("slot"));
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.toEpochMilli(), alarm);
    }

    static String currentSlot(PromptStore store) {
        org.json.JSONObject entry = store.entry(Instant.now(), false);
        return entry == null ? Instant.now().toString() : entry.optString("slot");
    }

    static void refresh(Context context, boolean allowNotification) {
        PromptStore store = new PromptStore(context);
        Instant now = Instant.now();
        org.json.JSONObject entry = store.entry(now, false);
        if (entry == null) return;
        String key = entry.optString("slot");
        org.json.JSONObject question = entry.optJSONObject("question");
        if (question == null) return;
        String snapshot = question.toString();
        if (!key.equals(store.state.getString("last_slot", ""))
                || !snapshot.equals(store.state.getString("current_snapshot", ""))) {
            store.state.edit().putString("current_snapshot", snapshot)
                    .putString("last_slot", key).apply();
            PromptWidget.updateAll(context);
        }
        LocalTime start = LocalTime.parse(store.state.getString("start", PromptStore.START));
        LocalTime end = LocalTime.parse(store.state.getString("end", PromptStore.END));
        LocalTime local = LocalTime.now();
        if (allowNotification && store.state.getBoolean("enabled", false)
                && !local.isBefore(start) && local.isBefore(end)
                && Duration.between(Instant.parse(key), now).toMinutes() < 10
                && !key.equals(store.state.getString("last_notified", ""))) {
            store.state.edit().putString("last_notified", key).apply();
            notify(context, store.current(), key, false);
        }
    }

    static void notify(Context context, PromptStore.Prompt prompt, String slot, boolean test) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
        if (channel == null) {
            NotificationChannel previous = manager.getNotificationChannel("practice");
            int importance = previous == null ? NotificationManager.IMPORTANCE_DEFAULT : previous.getImportance();
            channel = new NotificationChannel(CHANNEL, "Luyện nói · Let’s talk", importance);
            if (previous == null || previous.getSound() != null) {
                android.net.Uri sound = android.net.Uri.parse("android.resource://" + context.getPackageName() + "/raw/lets_talk");
                android.media.AudioAttributes attributes = new android.media.AudioAttributes.Builder()
                        .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION).build();
                channel.setSound(sound, attributes);
            } else {
                channel.setSound(null, null);
            }
            manager.createNotificationChannel(channel);
        }
        boolean translate = new PromptStore(context).state.getBoolean("translation", true);
        CharSequence detail = prompt.ja();
        if (translate) {
            SpannableString bilingual = new SpannableString(prompt.ja() + "\n" + prompt.vi());
            bilingual.setSpan(new RelativeSizeSpan(.82f), prompt.ja().length() + 1, bilingual.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            detail = bilingual;
        }
        Notification notification = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_prompt)
                .setContentTitle(test ? "FreeTalk · Thông báo thử" : "Let’s talk · FreeTalk")
                .setContentText(prompt.ja())
                .setStyle(new Notification.BigTextStyle().bigText(detail))
                .setWhen(java.time.Instant.parse(slot).toEpochMilli()).setShowWhen(true)
                .setContentIntent(PromptWidget.openQuestion(context, prompt, slot))
                .setAutoCancel(true)
                .build();
        manager.notify(test ? 2 : 1, notification);
    }
}
