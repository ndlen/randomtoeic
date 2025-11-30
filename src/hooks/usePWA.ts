import { useEffect, useState } from "react";

// Interface for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Service Worker registration và update handling
export const useServiceWorkerUpdate = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] =
        useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        // Không hiển thị update trong development mode
        if (import.meta.env.DEV) {
            console.log(
                "🚧 Development mode - skipping service worker updates"
            );
            return;
        }

        // Kiểm tra service worker support
        if ("serviceWorker" in navigator) {
            // Listen for controlling service worker changes
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                console.log(
                    "🔄 Service worker controller changed - reloading page"
                );
                window.location.reload();
            });

            // Check for waiting service worker
            navigator.serviceWorker.ready.then((registration) => {
                setRegistration(registration);

                if (registration.waiting) {
                    console.log("⏳ Service worker update available");
                    setUpdateAvailable(true);
                }

                // Listen for new service worker installation
                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener("statechange", () => {
                            if (
                                newWorker.state === "installed" &&
                                navigator.serviceWorker.controller
                            ) {
                                console.log("🆕 New service worker installed");
                                setUpdateAvailable(true);
                            }
                        });
                    }
                });
            });
        }
    }, []);

    const applyUpdate = () => {
        if (registration && registration.waiting) {
            console.log("📲 Applying service worker update");
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
    };

    return { updateAvailable, applyUpdate };
};

// PWA Install prompt hook
export const usePWAInstall = () => {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        const checkInstalled = () => {
            // Check display mode
            if (window.matchMedia("(display-mode: standalone)").matches) {
                setIsInstalled(true);
                return true;
            }

            // Check iOS standalone
            const nav = navigator as typeof navigator & {
                standalone?: boolean;
            };
            if (nav.standalone === true) {
                setIsInstalled(true);
                return true;
            }

            return false;
        };

        if (checkInstalled()) return;

        const handleBeforeInstallPrompt = (e: Event) => {
            const installEvent = e as BeforeInstallPromptEvent;
            installEvent.preventDefault();
            setDeferredPrompt(installEvent);
            setIsInstallable(true);
            console.log("💡 PWA installable");
        };

        const handleAppInstalled = () => {
            console.log("🎉 PWA installed");
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
        };

        window.addEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt
        );
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const promptInstall = async () => {
        if (!deferredPrompt) return false;

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            console.log("Install outcome:", outcome);

            setDeferredPrompt(null);
            setIsInstallable(false);

            return outcome === "accepted";
        } catch (error) {
            console.error("Install error:", error);
            return false;
        }
    };

    return {
        isInstallable,
        isInstalled,
        promptInstall,
    };
};

// Offline detection hook
export const useOfflineStatus = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            console.log("🌐 Back online");
            setIsOffline(false);
        };

        const handleOffline = () => {
            console.log("📱 Gone offline");
            setIsOffline(true);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return isOffline;
};
