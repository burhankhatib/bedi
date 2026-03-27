package com.burhankhatib.bedi;

import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

/**
 * Implements {@link ModifiedMainActivityForSocialLoginPlugin} so @capgo/capacitor-social-login
 * can use Google OAuth scopes (Credential Manager) on Android. See plugin Android docs.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Marker required by the plugin; no implementation needed.
    }
}
