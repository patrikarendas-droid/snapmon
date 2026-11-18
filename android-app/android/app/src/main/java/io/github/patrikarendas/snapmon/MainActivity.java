package io.github.patrikarendas.snapmon;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** SnapMon's single screen: the shared web game in Android System WebView (Capacitor), plus the SaveStore plugin. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SaveStorePlugin.class); // must be registered before super.onCreate() builds the bridge
        super.onCreate(savedInstanceState);
    }
}
