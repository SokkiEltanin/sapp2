package com.sokki.sapp2.wear

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import java.util.concurrent.TimeUnit

// Bateria zegarka → telefon (2026-11-16, user: "połączenie z Galaxy Watch 6 Classic,
// żeby monitorować jego baterię i w razie czego wysłać powiadomienie, żeby go
// podładować"). DataItem "/sapp2/battery" (poziom, ładowanie, model, czas) — telefon
// (WearListenerService z plugins/withWearSync.js) zapisuje go i powiadamia przy niskim
// poziomie. Wysyłane: co 15 min (WorkManager, przeżywa restart), przy otwarciu appki,
// przy każdym snapshotcie z telefonu i na prośbę telefonu ("/sapp2/battery-req").
object BatteryReporter {
    private const val WORK = "sapp2-battery"

    fun read(ctx: Context): Pair<Int, Boolean>? {
        val i: Intent = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return null
        val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        if (level < 0 || scale <= 0) return null
        val status = i.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        return Pair(Math.round(level * 100f / scale), charging)
    }

    /** Wysyła stan baterii; `wait` = poczekaj na zapis (z wątku w tle). */
    fun report(ctx: Context, wait: Boolean = false) {
        val (pct, charging) = read(ctx) ?: return
        try {
            val req = PutDataMapRequest.create("/sapp2/battery").apply {
                dataMap.putInt("level", pct)
                dataMap.putBoolean("charging", charging)
                dataMap.putString("model", Build.MODEL ?: "")
                dataMap.putLong("t", System.currentTimeMillis())
            }.asPutDataRequest().setUrgent()
            val task = Wearable.getDataClient(ctx).putDataItem(req)
            if (wait) Tasks.await(task, 20, TimeUnit.SECONDS)
        } catch (e: Exception) {}
    }

    fun schedule(ctx: Context) {
        try {
            val req = PeriodicWorkRequestBuilder<BatteryWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
        } catch (e: Exception) {}
    }
}

class BatteryWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        BatteryReporter.report(applicationContext, wait = true)
        return Result.success()
    }
}
