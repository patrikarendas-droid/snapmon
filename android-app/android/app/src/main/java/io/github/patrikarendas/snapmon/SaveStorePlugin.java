package io.github.patrikarendas.snapmon;

import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Durable copy of SnapMon's saved progress (see android-app/native/boot.js and docs/ANDROID.md).
 *
 * Every key the game stores is also written here as one small JSON file {"rev": n, "value": "..."} in the app's
 * private files directory (filesDir/snapmon-store). Writes use AtomicFile: the new content is written to a backup
 * file, flushed to disk (fsync) and then renamed, so a crash or power loss leaves either the old or the new save,
 * never a half-written one. The promise resolves only after the data is on disk.
 *
 * The directory is private to this app, survives app updates, and is deleted when the app is uninstalled or its
 * storage is cleared. It is excluded from Android backup (allowBackup=false), so a reinstall starts clean.
 * Calls run on Capacitor's plugin thread, one after another, in the order the game sent them.
 */
@CapacitorPlugin(name = "SnapmonSaveStore")
public class SaveStorePlugin extends Plugin {
    private static final int MAX_VALUE_CHARS = 16 * 1024 * 1024;

    private File dir() {
        File d = new File(getContext().getFilesDir(), "snapmon-store");
        if (!d.isDirectory() && !d.mkdirs()) throw new IllegalStateException("cannot create " + d);
        return d;
    }

    // file names are the hex of the key's UTF-8 bytes: any key is safe, and the key can be read back from the name
    private static String fileName(String key) {
        StringBuilder sb = new StringBuilder("k_");
        for (byte b : key.getBytes(StandardCharsets.UTF_8)) sb.append(String.format("%02x", b & 0xff));
        return sb.append(".json").toString();
    }

    private static String keyOf(String name) {
        String hex = name.substring(2, name.length() - 5);
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(hex.substring(2 * i, 2 * i + 2), 16);
        return new String(out, StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        Integer rev = call.getInt("rev", 0);
        if (key == null || key.isEmpty() || value == null) { call.reject("key and value are required"); return; }
        if (value.length() > MAX_VALUE_CHARS) { call.reject("value too large"); return; }
        AtomicFile f = new AtomicFile(new File(dir(), fileName(key)));
        FileOutputStream out = null;
        try {
            JSONObject o = new JSONObject();
            o.put("key", key);
            o.put("rev", rev == null ? 0 : rev);
            o.put("value", value);
            out = f.startWrite();
            out.write(o.toString().getBytes(StandardCharsets.UTF_8));
            f.finishWrite(out); // flushes, fsyncs and renames into place
            call.resolve();
        } catch (Exception e) {
            if (out != null) f.failWrite(out);
            call.reject("save copy failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null) { call.reject("key is required"); return; }
        new AtomicFile(new File(dir(), fileName(key))).delete();
        call.resolve();
    }

    @PluginMethod
    public void getAll(PluginCall call) {
        JSObject entries = new JSObject();
        File d = dir();
        String[] names = d.list();
        java.util.TreeSet<String> bases = new java.util.TreeSet<>();
        if (names != null) {
            for (String n : names) {
                // a write interrupted by a crash can leave only AtomicFile's ".bak"/".new" twin: readFully() recovers it
                if (n.endsWith(".bak") || n.endsWith(".new")) n = n.substring(0, n.length() - 4);
                if (n.startsWith("k_") && n.endsWith(".json")) bases.add(n);
            }
        }
        {
            for (String name : bases) {
                File file = new File(d, name);
                try {
                    byte[] data = new AtomicFile(file).readFully();
                    JSONObject o = new JSONObject(new String(data, StandardCharsets.UTF_8));
                    JSObject e = new JSObject();
                    e.put("rev", o.optLong("rev", 0));
                    e.put("value", o.getString("value"));
                    entries.put(keyOf(name), e);
                } catch (IOException | org.json.JSONException | RuntimeException e) {
                    // an unreadable file is skipped (and kept for inspection); the localStorage copy still applies
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("entries", entries);
        call.resolve(ret);
    }
}
