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
import java.time.ZonedDateTime;

public final class PromptAlarm extends BroadcastReceiver {
    private static final String TICK = "app.freetalk.japanese.TICK";
    private static final String CHANNEL = "practice";

    @Override public void onReceive(Context context, Intent intent) {
        refresh(context, TICK.equals(intent.getAction()));
        schedule(context);
    }

    private static LocalTime start(PromptStore store) {
        return LocalTime.parse(store.state.getString("start", PromptStore.START));
    }

    private static LocalTime end(PromptStore store) {
        return LocalTime.parse(store.state.getString("end", PromptStore.END));
    }

    static void schedule(Context context) {
        PromptStore store = new PromptStore(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent alarm = PendingIntent.getBroadcast(context, 0,
                new Intent(context, PromptAlarm.class).setAction(TICK), PendingIntent.FLAG_IMMUTABLE);
        alarms.cancel(alarm);

        ZonedDateTime now = ZonedDateTime.now();
        ZonedDateTime next = now.toLocalDate().atTime(start(store)).atZone(now.getZone());
        long interval = store.state.getInt("interval", PromptStore.INTERVAL);
        while (!next.isAfter(now) && next.toLocalTime().isBefore(end(store))) next = next.plusMinutes(interval);
        if (!next.toLocalTime().isBefore(end(store))) {
            next = now.toLocalDate().plusDays(1).atTime(start(store)).atZone(now.getZone());
        }
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.toInstant().toEpochMilli(), alarm);
    }

    private static ZonedDateTime latestSlot(PromptStore store, ZonedDateTime now) {
        LocalTime start = start(store);
        int interval = store.state.getInt("interval", PromptStore.INTERVAL);
        boolean beforeStart = now.toLocalTime().isBefore(start);
        LocalTime limit = beforeStart || !now.toLocalTime().isBefore(end(store))
                ? end(store).minusNanos(1) : now.toLocalTime();
        long minute = java.time.Duration.between(start, limit).toMinutes();
        return now.toLocalDate().minusDays(beforeStart ? 1 : 0)
                .atTime(start).plusMinutes((minute / interval) * interval).atZone(now.getZone());
    }

    static String currentSlot(PromptStore store) {
        return store.state.getString("last_slot", latestSlot(store, ZonedDateTime.now()).toInstant().toString());
    }

    static void refresh(Context context, boolean allowNotification) {
        PromptStore store = new PromptStore(context);
        ZonedDateTime now = ZonedDateTime.now();
        ZonedDateTime slot = latestSlot(store, now);
        String key = slot.toInstant().toString();
        String previous = store.state.getString("last_slot", "");
        if (key.equals(previous)) return;
        PromptStore.Prompt next = store.next(key);
        PromptWidget.updateAll(context);
        boolean active = !now.toLocalTime().isBefore(start(store)) && now.toLocalTime().isBefore(end(store));
        if (allowNotification && active && store.state.getBoolean("enabled", false)
                && (!previous.isEmpty() || java.time.Duration.between(slot, now).toMinutes() < 10)) {
            notify(context, next, key, false);
        }
    }

    static void notify(Context context, PromptStore.Prompt prompt, String slot, boolean test) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Luyện nói tiếng Nhật", NotificationManager.IMPORTANCE_DEFAULT));
        boolean translate = new PromptStore(context).state.getBoolean("translation", true);
        CharSequence detail = prompt.ja();
        if (translate) {
            SpannableString bilingual = new SpannableString(prompt.ja() + "\n" + prompt.vi());
            bilingual.setSpan(new RelativeSizeSpan(.82f), prompt.ja().length() + 1, bilingual.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            detail = bilingual;
        }
        Notification notification = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_prompt)
                .setContentTitle(test ? "FreeTalk · Thông báo thử" : "FreeTalk 日本語")
                .setContentText(prompt.ja())
                .setStyle(new Notification.BigTextStyle().bigText(detail))
                .setWhen(java.time.Instant.parse(slot).toEpochMilli()).setShowWhen(true)
                .setContentIntent(PromptWidget.openQuestion(context, prompt, slot))
                .setAutoCancel(true)
                .build();
        manager.notify(test ? 2 : 1, notification);
    }
}
