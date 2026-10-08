import { motion } from "motion/react";

export default function TextReveal({
    text,
    editKey,
    editLabel,
}: {
    text: string;
    /** Website Coding slot key (the text can be changed from the portal). */
    editKey?: string;
    editLabel?: string;
}) {
    return (
        <svg
            width="100%"
            height="100%"
            viewBox="0 0 300 100"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" />
                    <stop offset="100%" stopColor="var(--color-base-content)" />
                </linearGradient>
            </defs>
            <motion.text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                strokeWidth="0.3"
                fill="url(#gradient)"
                stroke="url(#gradient)"
                className="font-inter font-bold text-7xl stroke-1"
                data-edit-text={editKey}
                data-edit-label={editLabel}
                initial={{
                    strokeDashoffset: 1000,
                    strokeDasharray: 1000,
                    fillOpacity: 0,
                }}
                animate={{
                    strokeDashoffset: 0,
                    strokeDasharray: 1000,
                    fillOpacity: 1,
                    transition: {
                        default: {
                            ease: "easeInOut",
                            duration: 4,
                        },
                        fillOpacity: {
                            ease: "easeInOut",
                            duration: 2,
                        },
                    },
                }}
                // transition={{
                //     duration: 4,
                // }}
            >
                {text}
            </motion.text>
        </svg>
    );
}
