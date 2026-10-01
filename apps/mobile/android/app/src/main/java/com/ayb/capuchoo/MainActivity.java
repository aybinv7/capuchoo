package com.ayb.capuchoo;

import android.os.Bundle;
import com.ayb.capuchoo.device.CapuchooDevicePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CapuchooDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
