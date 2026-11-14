package com.sokki.sapp2.wear

import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

// Snapshot z telefonu przychodzi też, gdy appka na zegarku jest zamknięta: zapis do
// tych samych SharedPreferences co MainActivity + odświeżenie kafelka.
class DataListenerService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        var json: String? = null
        for (e in events) {
            if (e.type == DataEvent.TYPE_CHANGED && e.dataItem.uri.path == "/sapp2/snapshot") {
                json = DataMapItem.fromDataItem(e.dataItem).dataMap.getString("json")
            }
        }
        if (json != null) {
            getSharedPreferences(Snapshot.PREFS, MODE_PRIVATE).edit().putString(Snapshot.KEY, json).apply()
            try { TileService.getUpdater(this).requestUpdate(SappTileService::class.java) } catch (e: Exception) {}
        }
    }
}
