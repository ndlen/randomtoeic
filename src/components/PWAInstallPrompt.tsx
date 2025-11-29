import React, { useState, useEffect } from "react";

interface PWAInstallPromptProps {
    onInstallClick?: () => void;
}

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
    onInstallClick,
}) => {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Kiểm tra xem app đã được cài đặt chưa
        const checkIfInstalled = () => {
            // Kiểm tra display mode
            if (
                window.matchMedia &&
                window.matchMedia("(display-mode: standalone)").matches
            ) {
                setIsInstalled(true);
                return;
            }

            // Kiểm tra navigator.standalone (iOS Safari)
            if ((navigator as any).standalone === true) {
                setIsInstalled(true);
                return;
            }

            // Kiểm tra document.referrer (Android)
            if (document.referrer.includes("android-app://")) {
                setIsInstalled(true);
                return;
            }
        };

        checkIfInstalled();

        // Listen for beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();

            // Save the event so it can be triggered later
            setDeferredPrompt(e);
            setShowInstallButton(true);

            console.log("💡 PWA install prompt available");
        };

        // Listen for app installed event
        const handleAppInstalled = () => {
            console.log("🎉 PWA was installed");
            setIsInstalled(true);
            setShowInstallButton(false);
            setDeferredPrompt(null);
        };

        window.addEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt as EventListener
        );
        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt as EventListener
            );
            window.removeEventListener("appinstalled", handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            console.log("❌ No install prompt available");
            return;
        }

        try {
            // Show the install prompt
            await deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;

            console.log(`👤 User response to the install prompt: ${outcome}`);

            if (outcome === "accepted") {
                console.log("✅ User accepted the install prompt");
            } else {
                console.log("❌ User dismissed the install prompt");
            }

            // Clear the deferredPrompt variable
            setDeferredPrompt(null);
            setShowInstallButton(false);

            // Call optional callback
            if (onInstallClick) {
                onInstallClick();
            }
        } catch (error) {
            console.error("❌ Error during PWA installation:", error);
        }
    };

    // Don't show button if already installed or prompt not available
    if (isInstalled || !showInstallButton) {
        return null;
    }

    return (
        <button
            className="pwa-install-button"
            onClick={handleInstallClick}
            title="Cài đặt ứng dụng lên thiết bị"
        >
            📲 Cài đặt App
        </button>
    );
};

export default PWAInstallPrompt;
