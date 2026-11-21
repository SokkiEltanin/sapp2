package com.sokki.sapp2.wear

import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Humor na zegarku (2026-11-21, user: "humor ale nie bezelem, bo jak zrobić mesh 2D bezelem
// 1D… lepiej palcem na kole"). Ten sam pad co w telefonie (MoodPad.tsx): oś X = przyjemność
// (kolor), oś Y = energia (wielkość poświaty), wartości ciągłe 1..5. Kwadrat wpisany w okrągły
// ekran; palec może wyjechać poza kwadrat (wartość się przycina), więc rogi są osiągalne.
// Zapis = DataItem "/sapp2/mood/<id>" (Data Layer dośle go, gdy telefon wróci w zasięg);
// telefon dopisuje wpis przy otwarciu appki (plugins/withWearSync.js → wear_mood_queue.json).
object Mood {
    val COLORS = intArrayOf(0xFFEF4444.toInt(), 0xFFF97316.toInt(), 0xFFFBBF24.toInt(), 0xFFA3E635.toInt(), 0xFF22C55E.toInt())
    val MOOD = arrayOf("Fatalnie", "Słabo", "Tak sobie", "Dobrze", "Świetnie")
    val ENERGY = arrayOf("Bez energii", "Niska", "Średnia", "Dobra", "Pełna energia")
    fun level(v: Double) = min(5, max(1, v.roundToInt()))
    fun color(v: Double): Int {
        val x = min(5.0, max(1.0, v))
        val lo = x.toInt().coerceIn(1, 5)
        val hi = min(5, lo + 1)
        val t = (x - lo).toFloat()
        val a = COLORS[lo - 1]; val b = COLORS[hi - 1]
        fun ch(s: Int) = (((a shr s) and 0xFF) + ((((b shr s) and 0xFF) - ((a shr s) and 0xFF)) * t)).roundToInt()
        return Color.rgb(ch(16), ch(8), ch(0))
    }
    fun label(m: Double, e: Double) = MOOD[level(m) - 1] + " · " + ENERGY[level(e) - 1]

    const val LOCAL = "mood_local" // [{date, mood, energy, t}] zapisane na zegarku (zanim telefon potwierdzi)
    fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    fun save(ctx: Context, mood: Double, energy: Double) {
        val now = System.currentTimeMillis()
        val id = java.lang.Long.toString(now, 36) + Integer.toString((Math.random() * 1679616).toInt(), 36)
        val date = today()
        try {
            val req = PutDataMapRequest.create("/sapp2/mood/$id").apply {
                dataMap.putString("id", id)
                dataMap.putFloat("mood", mood.toFloat())
                dataMap.putFloat("energy", energy.toFloat())
                dataMap.putString("date", date)
                dataMap.putLong("t", now)
            }.asPutDataRequest().setUrgent()
            Wearable.getDataClient(ctx).putDataItem(req)
        } catch (e: Exception) {}
        val prefs = ctx.getSharedPreferences(Snapshot.PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(prefs.getString(LOCAL, "[]")) } catch (e: Exception) { JSONArray() }
        val keep = JSONArray()
        for (i in 0 until arr.length()) { val o = arr.optJSONObject(i) ?: continue; if (o.optString("date") == date) keep.put(o) }
        keep.put(JSONObject().put("date", date).put("mood", mood).put("energy", energy).put("t", now))
        prefs.edit().putString(LOCAL, keep.toString()).apply()
    }
}

class MoodPadView(ctx: Context, val onPick: (Double, Double) -> Unit) : View(ctx) {
    var mood: Double? = null
    var energy: Double? = null
    private val d = resources.displayMetrics.density
    private val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF161616.toInt() }
    private val tint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF2E2E2E.toInt(); strokeWidth = 1.5f * d }
    private val hint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF8A8A8A.toInt(); textSize = 10f * d; textAlign = Paint.Align.CENTER; typeface = Typeface.DEFAULT_BOLD }
    private val dot = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 2.5f * d; color = Color.WHITE }
    private val rect = RectF()
    private var lastCell = -1

    private fun side() = min(width, height) * 0.54f

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
        val s = side(); val cx = w / 2f; val cy = h / 2f
        rect.set(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2)
        tint.shader = LinearGradient(rect.left, 0f, rect.right, 0f, Mood.COLORS.map { (it and 0x00FFFFFF) or 0x30000000 }.toIntArray(), null, Shader.TileMode.CLAMP)
    }

    override fun onDraw(c: Canvas) {
        val r = 18f * d
        c.drawRoundRect(rect, r, r, bg)
        c.drawRoundRect(rect, r, r, tint)
        c.drawLine(rect.centerX(), rect.top + r, rect.centerX(), rect.bottom - r, line)
        c.drawLine(rect.left + r, rect.centerY(), rect.right - r, rect.centerY(), line)
        c.drawText("więcej energii", rect.centerX(), rect.top + 14f * d, hint)
        c.drawText("mniej energii", rect.centerX(), rect.bottom - 6f * d, hint)
        c.save(); c.rotate(-90f, rect.left + 11f * d, rect.centerY()); c.drawText("źle", rect.left + 11f * d, rect.centerY() + 4f * d, hint); c.restore()
        c.save(); c.rotate(90f, rect.right - 11f * d, rect.centerY()); c.drawText("super", rect.right - 11f * d, rect.centerY() + 4f * d, hint); c.restore()
        val m = mood ?: return
        val e = energy ?: return
        val x = rect.left + ((m - 1) / 4).toFloat() * rect.width()
        val y = rect.top + (1 - (e - 1) / 4).toFloat() * rect.height()
        val col = Mood.color(m)
        val k = ((e - 1) / 4).toFloat()
        glow.color = (col and 0x00FFFFFF) or 0x55000000
        c.drawCircle(x, y, 13f * d + k * 20f * d, glow)
        dot.color = col
        c.drawCircle(x, y, 12f * d, dot)
        c.drawCircle(x, y, 12f * d, ring)
    }

    override fun onTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN || ev.actionMasked == MotionEvent.ACTION_MOVE) {
            parent?.requestDisallowInterceptTouchEvent(true)
            val nx = ((ev.x - rect.left) / rect.width()).coerceIn(0f, 1f)
            val ny = ((ev.y - rect.top) / rect.height()).coerceIn(0f, 1f)
            val m = 1 + nx * 4.0
            val e = 1 + (1 - ny) * 4.0
            mood = (m * 100).roundToInt() / 100.0
            energy = (e * 100).roundToInt() / 100.0
            val cell = Mood.level(m) * 10 + Mood.level(e)
            if (cell != lastCell) { if (lastCell != -1) performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK); lastCell = cell }
            onPick(mood!!, energy!!)
            invalidate()
            return true
        }
        return ev.actionMasked == MotionEvent.ACTION_UP || super.onTouchEvent(ev)
    }
}

class MoodPadActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val d = resources.displayMetrics.density
        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        val label = TextView(this).apply {
            text = "Dotknij i przesuń"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.parseColor("#F2F2F2"))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        val save = TextView(this).apply {
            text = "Zapisz"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.BLACK)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            alpha = 0.35f
            isEnabled = false
            background = GradientDrawable().apply { cornerRadius = 22f * d; setColor(Color.parseColor("#D6D6D6")) }
        }
        lateinit var pad: MoodPadView
        pad = MoodPadView(this) { m, e ->
            label.text = Mood.label(m, e)
            label.setTextColor(Mood.color(m))
            if (!save.isEnabled) { save.isEnabled = true; save.alpha = 1f }
        }
        save.setOnClickListener {
            val m = pad.mood ?: return@setOnClickListener
            val e = pad.energy ?: return@setOnClickListener
            it.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
            Mood.save(this, m, e)
            setResult(RESULT_OK)
            finish()
        }
        root.addView(pad, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        val w = resources.displayMetrics.widthPixels
        root.addView(label, FrameLayout.LayoutParams((w * 0.7).roundToInt(), FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply { topMargin = (w * 0.1).roundToInt() })
        root.addView(save, FrameLayout.LayoutParams((w * 0.36).roundToInt(), (40 * d).roundToInt(), Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = (w * 0.05).roundToInt() })
        setContentView(root)
    }
}
