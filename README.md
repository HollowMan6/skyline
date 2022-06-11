Given a Beeminder username, apikey, goal slug and year, get a pretty skyline. Think "calendar heatmap" but in 3D.

## Setup

Make sure you have node js and npm. Then, clone repo.

Run once:
```
npm install
```
and then:
```
npm run start
```

then, append to the URL:

```
?username=<username>&apikey=<apikey>&goal=<goal-slug>&year=<year>
```

If no year is provided, the current year will be used.

## Development

Math is not yet 100% correct imo.

Note that this version creates a distribution from the 99th percentile on the contributions per day to stop the odd _really_ big days blowing out the scale. It also has a default minimum for non-zero contribition days (10% of the maximum height)




