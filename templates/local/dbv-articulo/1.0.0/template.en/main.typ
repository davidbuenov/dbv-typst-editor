// Academic paper. The details below were filled in by the DBV Typst Editor
// wizard; they are plain text and you can change them whenever you like.

#import "style.typ": paper

#show: paper.with(
  title: "{{titulo}}",
  author: "{{autor}}",
  affiliation: "{{institucion}}",
  email: "{{correo}}",
  abstract: "{{resumen}}",
  keywords: "{{palabrasClave}}",
)

= Introduction

State the problem, place the work in the literature and preview the
contribution. Citations are written like this @knuth1984.

= Method

Describe the procedure in enough detail for someone else to reproduce it.

$ hat(theta) = arg max_theta sum_(i=1)^n log p(x_i bar theta) $

= Results

#figure(
  table(
    columns: 3,
    align: (left, right, right),
    table.header([Method], [Precision], [F1]),
    [Baseline], [0.81], [0.79],
    [Proposed], [0.93], [0.92],
  ),
  caption: [Results on the test set.],
) <tab-results>

As @tab-results shows, the proposal improves on the baseline.

= Discussion

Interpret the results and acknowledge the limitations of the study.

= Conclusions

Close with the main contribution and future work.

#bibliography("refs.bib", title: [References], style: "ieee")
