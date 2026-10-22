from pathlib import Path

root = Path("android/app/src/main/java/com/tryd/app")
root.mkdir(parents=True, exist_ok=True)

plugin = r"""package com.tryd.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;

@CapacitorPlugin(
    name = "Downloads",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class DownloadsPlugin extends Plugin {
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !hasPermission("notifications")) {
            requestPermissionForAlias("notifications", call, "saveAfterNotificationPermission");
            return;
        }
        saveFileAndNotify(call);
    }

    @PermissionCallback
    private void saveAfterNotificationPermission(PluginCall call) {
        // A declined notification permission must not block saving the requested file.
        saveFileAndNotify(call);
    }

    private void saveFileAndNotify(PluginCall call) {
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
            if (uri == null) throw new IllegalStateException("Android tidak dapat membuat file di folder Download.");

            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException("Tidak dapat membuka file tujuan.");
                output.write(bytes);
                output.flush();
            }

            ContentValues published = new ContentValues();
            published.put(MediaStore.Downloads.IS_PENDING, 0);
            if (getContext().getContentResolver().update(uri, published, null, null) <= 0) {
                throw new IllegalStateException("Android gagal menyelesaikan penyimpanan file ke folder Download.");
            }

            try (android.database.Cursor cursor = getContext().getContentResolver().query(
                    uri,
                    new String[] { MediaStore.Downloads.DISPLAY_NAME, MediaStore.Downloads.SIZE, MediaStore.Downloads.IS_PENDING },
                    null, null, null)) {
                if (cursor == null || !cursor.moveToFirst()) {
                    throw new IllegalStateException("File belum ditemukan kembali di folder Download setelah ditulis.");
                }
                int sizeIndex = cursor.getColumnIndex(MediaStore.Downloads.SIZE);
                int pendingIndex = cursor.getColumnIndex(MediaStore.Downloads.IS_PENDING);
                if (sizeIndex >= 0 && cursor.getLong(sizeIndex) <= 0) throw new IllegalStateException("File di folder Download kosong.");
                if (pendingIndex >= 0 && cursor.getInt(pendingIndex) != 0) throw new IllegalStateException("File belum selesai disimpan.");
            }

            // Native Android notification is posted only after MediaStore verification succeeds.
            postDownloadNotification(filename, uri);
            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("filename", filename);
            result.put("folder", "Download/Try-D");
            result.put("notificationShown", canPostNotifications());
            call.resolve(result);
        } catch (Exception error) {
            if (uri != null) {
                try { getContext().getContentResolver().delete(uri, null, null); } catch (Exception ignored) {}
            }
            call.reject("Gagal menyimpan ke Download/Try-D: " + error.getMessage(), error);
        }
    }

    private boolean canPostNotifications() {
        return Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void postDownloadNotification(String filename, Uri fileUri) {
        if (!canPostNotifications()) return;
        String channelId = "tryd_downloads";
        NotificationManager manager = (NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Unduhan Try-D", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Pemberitahuan saat file desain berhasil disimpan.");
            manager.createNotificationChannel(channel);
        }

        Intent openFile = new Intent(Intent.ACTION_VIEW);
        openFile.setDataAndType(fileUri, getContext().getContentResolver().getType(fileUri));
        openFile.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            getContext(), (int) (System.currentTimeMillis() & 0x7fffffff), openFile,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder notification = new NotificationCompat.Builder(getContext(), channelId)
            .setSmallIcon(getContext().getApplicationInfo().icon)
            .setContentTitle("File Try-D berhasil diunduh")
            .setContentText(filename + " • Download/Try-D")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(filename + "\\nLokasi: Download/Try-D"))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification.build());
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
manifest = Path("android/app/src/main/AndroidManifest.xml")
if manifest.exists():
    manifest_text = manifest.read_text(encoding="utf-8")
    permission = '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
    if permission not in manifest_text:
        manifest_text = manifest_text.replace("<manifest", "<manifest", 1)
        close = manifest_text.find(">")
        if close < 0:
            raise SystemExit("Tag manifest tidak ditemukan.")
        manifest_text = manifest_text[:close + 1] + "\\n    " + permission + manifest_text[close + 1:]
        manifest.write_text(manifest_text, encoding="utf-8")
else:
    raise SystemExit("AndroidManifest.xml tidak ditemukan.")

print("Native Downloads plugin terpasang.")
