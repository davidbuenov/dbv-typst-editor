= Analysis

The body of the report. A data table, ready to replace:

#figure(
  table(
    columns: 3,
    align: (left, right, right),
    table.header([Indicator], [Value], [Target]),
    [Availability], [99.2%], [99.5%],
    [Response time], [180 ms], [150 ms],
  ),
  caption: [Key indicators for the period analysed.],
)

And a figure with a caption:

#figure(
  rect(width: 60%, height: 3cm, stroke: 0.5pt),
  caption: [Replace this rectangle with `image("../images/diagram.png")`.],
)
