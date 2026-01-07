'use client';

import styles from './Create.module.css';
import Chat_Create from './chat/Chat_Create';
import Content_Create from './content/Content_Create';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet';
import { useCreateStore } from './stores/create-store';

/**
 * Create 页面主组件
 * Header中的按钮控制聊天区域的显示
 */
export default function Create() {
    const isChatOpen = useCreateStore((state) => state.isChatOpen);
    const setChatOpen = useCreateStore((state) => state.setChatOpen);

    return (
        <div className={styles.create}>
            {/* 聊天区域 Sheet */}
            <Sheet open={isChatOpen} onOpenChange={setChatOpen}>
                <SheetContent
                    side="right"
                    className={styles.chat_sheet_content}
                    sheetOverlayClassName="bg-black/60"
                >
                    <SheetTitle className="sr-only">Chat</SheetTitle>
                    <Chat_Create />
                </SheetContent>
            </Sheet>

            {/* 内容区域组件 */}
            <div className={styles.content_area}>
                <Content_Create />
            </div>
        </div>
    );
}
