// Defense in depth: retired demos cannot render if the proxy is bypassed.
import {notFound} from "next/navigation";
export default function RetiredDemoLayout(): never { notFound(); }
