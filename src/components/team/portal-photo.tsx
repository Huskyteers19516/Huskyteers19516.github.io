/**
 * A teammate's portal photo laid over the photo frame it belongs to (a card
 * on the Our Team page, the profile dialog's avatar, a /progress row). The
 * frame keeps its fixed size and whatever it already shows (the build-time
 * photo or initials) underneath: the portal photo fades in on top once it
 * has loaded, so nothing moves, and if it fails to load it just goes away
 * and the frame shows what it had.
 *
 * `alt=""`: the person's name is always right next to it.
 * Remount it per photo (`key={src}`) so a new photo starts hidden again.
 */
import { useCallback, useState } from "react";
import { cn } from "../../lib/utils";

export function PortalPhoto({
    src,
    className,
    lazy = true,
}: {
    src: string;
    className?: string;
    /** Off-screen frames load when scrolled near (cards, rows). */
    lazy?: boolean;
}) {
    const [state, setState] = useState<"loading" | "loaded" | "failed">(
        "loading",
    );
    // A cached image can be complete before React's onLoad is attached.
    const ref = useCallback((img: HTMLImageElement | null) => {
        if (img?.complete && img.naturalWidth > 0) setState("loaded");
    }, []);
    if (state === "failed") return null;
    return (
        <img
            ref={ref}
            src={src}
            alt=""
            width={512}
            height={512}
            loading={lazy ? "lazy" : undefined}
            decoding="async"
            draggable={false}
            data-loaded={state === "loaded" ? "" : undefined}
            className={cn("portal-photo", className)}
            onLoad={() => setState("loaded")}
            onError={() => setState("failed")}
        />
    );
}
