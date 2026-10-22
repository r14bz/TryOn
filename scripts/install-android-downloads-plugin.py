from pathlib import Path

root = Path("android/app/src/main/java/com/tryd/app")
root.mkdir(parents=True, exist_ok=True)

plugin = r"""package com.tryd.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "Downloads")
public class DownloadsPlugin extends Plugin {
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Penyimpanan Download otomatis memerlukan Android 10 atau lebih baru.");
            return;
        }

        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String data = call.getString("data");
        if (filename == null || filename.trim().isEmpty() || data == null) {
            call.reject("Nama file atau data file kosong.");
            return;
        }

        Uri uri = null;
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Try-D");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("Android tidak dapat membuat file di folder Download.");
            }

            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException("Tidak dapat membuka file tujuan.");
                output.write(bytes);
                output.flush();
            }

            ContentValues published = new ContentValues();
            published.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(uri, published, null, null);

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("filename", filename);
            result.put("folder", "Download/Try-D");
            call.resolve(result);
        } catch (Exception error) {
            if (uri != null) {
                try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) {}
            }
            call.reject("Gagal menyimpan ke Download/Try-D: " + error.getMessage(), error);
        }
    }
}
"""
(root / "DownloadsPlugin.java").write_text(plugin, encoding="utf-8")

java_activity = root / "MainActivity.java"
kotlin_activity = root / "MainActivity.kt"
if java_activity.exists():
    text = java_activity.read_text(encoding="utf-8")
    if "registerPlugin(DownloadsPlugin.class)" not in text:
        text = text.replace("public class MainActivity extends BridgeActivity {",
                            "public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(DownloadsPlugin.class);\n        super.onCreate(savedInstanceState);\n    }")
        java_activity.write_text(text, encoding="utf-8")
elif kotlin_activity.exists():
    text = kotlin_activity.read_text(encoding="utf-8")
    if "registerPlugin(DownloadsPlugin::class.java)" not in text:
        text = text.replace("class MainActivity : BridgeActivity()", """class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(DownloadsPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}""")
        kotlin_activity.write_text(text, encoding="utf-8")
else:
    raise SystemExit("MainActivity.java/kt tidak ditemukan di proyek Android hasil cap add.")
print("Native Downloads plugin terpasang.")
