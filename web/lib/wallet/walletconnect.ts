import { useEffect } from "react";
import { useConfig, type CreateConnectorFn } from "wagmi";
import { reconnect } from "wagmi/actions";
import { walletConnect } from "wagmi/connectors/walletConnect";

// WalletConnect: phone wallets over a QR code or a deep link (ARCHITECTURE §9.3).
// Reown project id: public by design (it reaches every browser); the project's domain allowlist
// (Reown dashboard → Configuration → Domain) limits where it works.
export const WALLETCONNECT_PROJECT_ID = "7fa4474c2a8a855edb5d7865014aac89";

let connectorFn: CreateConnectorFn | undefined;

/**
 * The WalletConnect connector, made on first use and kept for the page's life. It is not in the
 * wagmi config on purpose: the connector's setup loads @walletconnect/ethereum-provider and its
 * modal (@reown/appkit) and opens a relay connection, which every visitor would pay for on every
 * page. Passed to connect() / reconnect() instead, it loads only for people who pick it.
 */
export function walletConnectConnector(): CreateConnectorFn {
  if (!connectorFn) {
    const origin = window.location.origin;
    connectorFn = walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      // What the wallet shows for the connection request; without it, it reads "WalletConnect"
      metadata: {
        name: "PikaMd",
        description: "Share Markdown guidelines for AI agents, collect them and use them over MCP",
        url: origin,
        icons: [`${origin}/icon.png`],
      },
      qrModalOptions: {
        themeMode: "dark",
        themeVariables: {
          "--wcm-accent-color": "#FFCB05",
          "--wcm-background-color": "#1A0800",
          "--wcm-container-border-radius": "0px",
        },
      },
    });
  }
  return connectorFn;
}

export const WALLETCONNECT_ID = "walletConnect";

/**
 * Brings a WalletConnect session back after a reload. wagmi reconnects on mount with the connectors
 * in its config only, and WalletConnect isn't one of them (see above). So once that first reconnect
 * has settled (status leaves connecting/reconnecting), if it found nothing and WalletConnect was
 * the last wallet used, reconnect with it. Not earlier: a reconnect already running makes any other
 * call return without doing anything, and it clears that guard just after its final status update.
 */
export function useRestoreWalletConnect() {
  const config = useConfig();
  useEffect(() => {
    const busy = (status: string) => status === "connecting" || status === "reconnecting";
    let seenBusy = busy(config.state.status);
    const unsubscribe = config.subscribe(
      (state) => state.status,
      (status) => {
        if (busy(status)) {
          seenBusy = true;
          return;
        }
        if (!seenBusy) return;
        unsubscribe();
        if (status !== "disconnected") return;
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
          if ((await config.storage?.getItem("recentConnectorId")) !== WALLETCONNECT_ID) return;
          await reconnect(config, { connectors: [walletConnectConnector()] });
        })();
      },
    );
    return unsubscribe;
  }, [config]);

  // wagmi keeps "recentConnectorId" after a disconnect. Once a WalletConnect session ends (Disconnect
  // here, or ended from the phone), forget it, or every later visit would load WalletConnect again.
  useEffect(() => {
    let lastId: string | undefined;
    return config.subscribe(
      (state) => (state.current ? state.connections.get(state.current)?.connector.id : undefined),
      (id) => {
        if (!id && lastId === WALLETCONNECT_ID) void config.storage?.removeItem("recentConnectorId");
        lastId = id;
      },
    );
  }, [config]);
}
