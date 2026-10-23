"use client"

import { useEffect, useState } from "react"
import {
  dtNowLocaleFormatTime12hAmPm,
} from "@/lib/datetimeUtils"

export default function Clock({ darkMode = false }: { darkMode?: boolean }) {
  const [time, setTime] = useState(dtNowLocaleFormatTime12hAmPm)

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(dtNowLocaleFormatTime12hAmPm())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className={`${
        !darkMode ? "bg-mosqueBrand-onPrimary" : ""
      } p-7 text-center md:text-left md:w-fit`}
    >
      <time
        className={`text-5xl md:text-8xl font-bold ${
          !darkMode ? "text-mosqueBrand" : "text-gray-500"
        }`}
      >
        {time}
      </time>
    </div>
  )
}
