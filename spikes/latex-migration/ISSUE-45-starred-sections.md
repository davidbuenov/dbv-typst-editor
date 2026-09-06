<!--
Publicado: https://github.com/scipenai/tylax/issues/45 (2026-09-06).
Relacionada: scipenai/tylax#44 — pérdida silenciosa con \subfloat.
-->

## Summary

`\section*{...}` (and `\subsection*`, `\subsubsection*`) converts to a heading whose content is a bare `*`, with the actual title pushed onto the following line as body text.

Two consequences:

1. The output **does not compile**: Typst reads the lone `*` as an unclosed strong-emphasis delimiter.
2. Even ignoring the compile error, the title **stops being a heading** — it becomes a normal paragraph, so it disappears from the document outline and from any table of contents.

## Version

- `tylax` 0.3.7 (CLI `t2l 0.3.7`)
- Windows 11, Rust stable
- Output compiled with Typst 0.15.1

## Minimal reproduction

```latex
\documentclass{article}
\begin{document}
\section{Numbered section}
\section*{Unnumbered section}
\subsection*{Unnumbered subsection}
\end{document}
```

```bash
t2l main.tex -o out.typ
```

## Actual output

```typst
== Numbered section

== *
Unnumbered section
=== *
Unnumbered subsection
```

Compiling `out.typ` with Typst 0.15.1:

```
error: unclosed delimiter
error: unclosed delimiter
```

## Expected output

The starred form suppresses numbering in LaTeX, so a faithful mapping would keep the text as a heading and disable its numbering, e.g.:

```typst
#heading(numbering: none)[Unnumbered section]
```

Even simply emitting `== Unnumbered section` (losing only the numbering suppression) would be much better than the current result, which loses the heading structure *and* breaks compilation.

## Why it matters

Starred sections are the standard way to write "Acknowledgements", "Limitations", "Future work" and similar sections in academic papers, so they show up in most conference and journal submissions. Found in two of three real papers while evaluating Tylax as the conversion engine for a desktop Typst editor.
