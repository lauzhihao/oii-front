'use client'

import {
    Sidebar,
    SidebarFooter,
    SidebarContent,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SidebarTabEnum } from "../type/sidebar-tab-enum";
import Link from "next/link";
import styles from "./Sidebar.module.css";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ChevronLeft, Home } from "lucide-react";
import TwitterIcon from "@/components/common/icon/brand/TwitterIcon";
import DiscordIcon from "@/components/common/icon/brand/DiscordIcon";
import NavGroup from "./nav/NavGroup";

function HeaderLogo_Collapsed() {
    const [isHover, setIsHover] = useState(false);
    return (
        <motion.div className={cn(
            'sidebar-header-logo',
            styles.sidebar_header_logo,
        )}
            onHoverStart={() => setIsHover(true)}
            onHoverEnd={() => setIsHover(false)}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
                opacity: { duration: 1 }
            }}
        >
            <AnimatePresence>
                {isHover ?
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                            opacity: { duration: 0.3 }
                        }}
                        className={cn(
                            'sidebar-header-logo',
                            styles.sidebar_header_logo,
                            'flex flex-row justify-between items-center'
                        )}
                    >
                        <SidebarTrigger className='cursor-pointer size-12'>
                            <ChevronLeft className="size-6 opacity-50" />
                        </SidebarTrigger>
                    </motion.div>
                    : <Home className="size-12" />}
            </AnimatePresence>
        </motion.div>
    )
}


type BaseSidebarProps = {
    className?: string;
    activeTab: string
    onTabClick: (navKey: string) => void;
    collapsible?: 'offcanvas' | 'icon' | 'none';
}

function BaseSidebar({
    className,
    activeTab,
    onTabClick,
    collapsible = 'icon'
}: BaseSidebarProps) {
    const { state, setOpen } = useSidebar();

    useEffect(() => {
        if (collapsible === 'none') {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, []);

    return (
        <Sidebar
            side="left"
            variant="sidebar"
            collapsible={collapsible}
            className={cn(
                styles.sidebar,
                state === 'collapsed' && 'w-0',
                className,
            )}
            animateOnHover={false}
            disableMobile={true}
        >
            {/* <SidebarHeader
                className={cn(
                    'p-3',
                )}
            >
                <AnimatePresence mode="wait">
                    {state === 'collapsed' && <HeaderLogo_Collapsed />}
                    {state !== 'collapsed' && (
                        <motion.div
                            className={cn(
                                'flex flex-row justify-between items-center'
                            )}
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{
                                opacity: { duration: 3 }
                            }}
                        >
                            <div className={cn(
                                'sidebar-header-logo',
                                styles.sidebar_header_logo,
                            )}>
                                <Tapi_Sidebar className="size-12" />
                                <span
                                    className={styles.sidebar_header_logo_text}
                                >
                                    Tapi
                                </span>
                            </div>
                            <SidebarTrigger className='cursor-pointer'>
                                <Collapse_Sidebar className="size-6 opacity-50" />
                            </SidebarTrigger>
                        </motion.div>
                    )}
                </AnimatePresence>
            </SidebarHeader> */}
            <SidebarContent
                className={cn(
                    styles.sidebar_content,
                )}
            >
                <div className={cn(
                    styles.sidebar_content_content,
                )}>

                    {/* 页面导航 */}
                    <NavGroup
                        activeTab={activeTab} onTabClick={onTabClick}
                    />

                </div>

                {/* 底部footer */}
                <div className={cn(
                    'flex flex-col gap-2',
                )}>
                    <div className={cn(
                        'flex flex-col gap-2',
                        state === 'collapsed' && 'opacity-0 hidden'
                    )}>
                        <Link
                            className={styles.footer_link}
                            href="/private_privacy"
                        >
                            {'Private '}<span className={styles.footer_link_text}
                            >privacy</span>
                        </Link>
                        <Link
                            className={styles.footer_link}
                            href="/terms_of_service"
                        >
                            <span className={styles.footer_link_text}
                            >Terms</span>{' of Service'}
                        </Link>
                        <span className={styles.footer_link}>© 2025 VOOICE Ai</span>
                    </div>
                    <div className={cn(
                        'flex flex-row flex-nowrap gap-3 transition-all duration-300',
                        state === 'collapsed' && 'flex-col'
                    )}>
                        <Link
                            target="_blank"
                            href={process.env.NEXT_PUBLIC_DISCORD_URL ?? "https://www.vooice.tech"}
                            className={cn(
                                styles.footer_link_icon_wrapper,
                            )}
                        >
                            <DiscordIcon />
                        </Link>
                        <Link
                            target="_blank"
                            href={process.env.NEXT_PUBLIC_TWITTER_URL ?? "https://www.vooice.tech"}
                            className={styles.footer_link_icon_wrapper}>
                            <TwitterIcon />
                        </Link>
                    </div>
                </div>
            </SidebarContent>

            <SidebarFooter
                className={cn(
                    'flex flex-col gap-4',
                    'p-0',
                )}
            />

        </Sidebar>
    )
}

export default BaseSidebar;


