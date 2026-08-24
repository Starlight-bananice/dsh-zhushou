import type { ReactNode } from 'react';
/** 行内 label + 控件场。 */
export declare function Field({ label, hint, children, }: {
    label?: string;
    hint?: string;
    children: ReactNode;
}): import("react").JSX.Element;
/** 开关。 */
export declare function Toggle({ checked, onChange, label, }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label?: string;
}): import("react").JSX.Element;
/** 文本输入。 */
export declare function TextInput({ value, onChange, placeholder, style, }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
}): import("react").JSX.Element;
/** 数字输入（值可空）。 */
export declare function NumberInput({ value, onChange, placeholder, min, step, }: {
    value: number | null;
    onChange: (v: number | null) => void;
    placeholder?: string;
    min?: number;
    step?: number;
}): import("react").JSX.Element;
/** 下拉选择（值含 '' 空选项）。 */
export declare function Select({ value, onChange, options, placeholder, }: {
    value: string;
    onChange: (v: string) => void;
    options: {
        value: string;
        label: string;
    }[];
    placeholder?: string;
}): import("react").JSX.Element;
/** 滑块（显示当前值）。 */
export declare function Slider({ value, onChange, min, max, step, format, }: {
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    format?: (v: number) => string;
}): import("react").JSX.Element;
/** 标签编辑器：输入 + 回车添加 + 删除。 */
export declare function TagEditor({ tags, onChange, }: {
    tags: string[];
    onChange: (tags: string[]) => void;
}): import("react").JSX.Element;
/** 通用错误条。 */
export declare function ErrorNote({ message }: {
    message: string;
}): import("react").JSX.Element;
/** 加载条。 */
export declare function LoadingNote({ text }: {
    text?: string;
}): import("react").JSX.Element;
/** 空态。 */
export declare function EmptyNote({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=ui.d.ts.map