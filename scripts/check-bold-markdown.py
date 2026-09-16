#!/usr/bin/env python3
"""
docs/ 配下のMarkdownで、日本語テキストに隣接する **太字** がCommonMarkの
punctuation-flanking rule により正しく閉じないケースを検出する。

例: "**OIDC（OpenID Connect）は「認証」**のためのプロトコル"
    -> 閉じの ** の直前が「」(句読点) で、直後が「の」(非句読点) だと
       right-flanking にならず、太字ではなく **リテラル文字列** として
       描画されてしまう。

使い方:
    python3 scripts/check-bold-markdown.py [path/to/*.md ...]
    引数を省略すると docs/ 配下の全 .md を検査する。
"""
import re
import sys
import unicodedata
import glob


def is_punct(ch):
    if ch is None:
        return False
    return unicodedata.category(ch).startswith("P")


def is_space(ch):
    if ch is None:
        return True
    return ch.isspace()


def find_broken(text: str):
    broken = []
    for m in re.finditer(r"\*\*(.+?)\*\*", text, re.S):
        start, end = m.start(), m.end()
        prev_close = text[end - 3] if end - 3 >= 0 else None
        next_ch = text[end] if end < len(text) else None
        right_flanking = (not is_space(prev_close)) and (
            not is_punct(prev_close) or is_space(next_ch) or is_punct(next_ch)
        )
        if not right_flanking:
            line = text.count("\n", 0, start) + 1
            broken.append((line, m.group(1)[:30], next_ch))
    return broken


def main():
    files = sys.argv[1:] or glob.glob("docs/**/*.md", recursive=True)
    total = 0
    for f in files:
        text = open(f, encoding="utf-8").read()
        for line, snippet, next_ch in find_broken(text):
            print(f"{f}:{line}: BROKEN -> '**{snippet}**' followed by {next_ch!r}")
            total += 1
    if total:
        print(f"\n{total} 件の壊れた太字が見つかりました。")
        sys.exit(1)
    print("OK: 壊れた太字はありません。")


if __name__ == "__main__":
    main()
