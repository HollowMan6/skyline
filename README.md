Given a Github username and a year, renders a 3D model of their contribution chart. The data is fetched via https://github.com/grubersjoe/github-contributions-api (https://github-contributions-api.jogruber.de/v4/HollowMan6?y=2023)).

```
?username=<username>&year=<year>
```

If no year is provided, the current year will be used.

Examples: 
 - http://localhost:3000/?username=HollowMan6
 - http://localhost:3000/?username=HollowMan6&year=2023

#### Development

I've been using `vercel` for local dev. To load up a local server: `vercel dev`.

Note that this version creates a distribution from the 99th percentile on the contributions per day to stop the odd _really_ big days blowing out the scale. It also has a default minimum for non-zero contribition days (10% of the maximum height)

