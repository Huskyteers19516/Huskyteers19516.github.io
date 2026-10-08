"use client";
import { useScroll, useTransform, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import TeamImage from "../assets/images/2023-2024/team.png";
import { ArrowUpRight } from "lucide-react";

export interface TimelineEntry {
    title: string;
    season: string;
    content: React.ReactNode;
}

export const Timeline = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setHeight(rect.height);
        }
    }, [ref]);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start 10%", "end 50%"],
    });

    const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
    const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

    return (
        <div className="mx-auto font-inter container" ref={containerRef}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 place-items-start">
                <div className="max-w-7xl mx-auto py-20 px-4 md:px-8 lg:px-10">
                    {/* "Website Coding" slots: changed in the portal (Admin -> Website Coding). */}
                    <h2
                        className="text-lg md:text-4xl mb-4 text-foreground max-w-4xl font-semibold"
                        data-edit-text="home.about.title"
                        data-edit-label="Home: About Us heading"
                    >
                        About Us
                    </h2>
                    <p
                        className="text-muted-foreground text-sm md:text-base max-w-sm"
                        data-edit-text="home.about.text"
                        data-edit-label="Home: About Us text"
                        data-edit-multiline
                    >
                        We are an FTC team from Fairmont Preparatory Academy,
                        entering our third year in the FIRST Tech Challenge.
                        Combining business and technical skills, our team
                        thrives on collaboration and innovation, driven by
                        strong bonds and a shared commitment to STEM excellence.
                    </p>
                    <a href="/about/team">
                        <div className="btn btn-primary mt-3">
                            <span
                                data-edit-text="home.about.button"
                                data-edit-label="Home: About Us button"
                            >
                                Our Team
                            </span>{" "}
                            <ArrowUpRight />
                        </div>
                    </a>
                </div>
                <a href="/about/team">
                    <img
                        src={TeamImage.src}
                        className="rounded-lg shadow-sm"
                        alt="Team Photo"
                        data-edit-image="home.about.photo"
                        data-edit-label="Home: About Us team photo"
                    />
                </a>
            </div>

            <div ref={ref} className="relative max-w-7xl mx-auto pb-20">
                {children}
                <div
                    style={{
                        height: height + "px",
                    }}
                    className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-neutral-200 dark:via-neutral-700 to-transparent to-[99%]  [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] "
                >
                    <motion.div
                        style={{
                            height: heightTransform,
                            opacity: opacityTransform,
                        }}
                        className="absolute inset-x-0 top-0  w-[2px] bg-gradient-to-t from-primary via-emerald-600 to-transparent from-[0%] via-[10%] rounded-full"
                    />
                </div>
            </div>
        </div>
    );
};
