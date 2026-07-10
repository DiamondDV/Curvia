import {
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import React, {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { generateVectorSource } from "./lib/pollinations";
import {
  type VectorizeResult,
  type VectorizeSettings,
  vectorizeImage,
} from "./lib/vectorize";

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768" role="img" aria-labelledby="vector-title vector-description" data-generator="Curvia Local Trace">
  <title id="vector-title">Editable vector artwork</title>
  <desc id="vector-description">Locally traced artwork with named color groups and individually addressable paths.</desc>
  <metadata>Generated locally with Curvia color tracing. Every color layer and path includes a stable editor label.</metadata>
  <g id="color-layer-01" data-layer-name="Orange #513710 shapes" fill="#513710" fill-rule="nonzero">
    <title>Orange #513710 shapes</title>
    <path id="layer-01-path-001" data-element-name="Orange #513710, region 1" d="M 328.5 129 L 329 129.5 L 327.5 131 L 327 130.5 L 328.5 129 Z ">
      <title>Orange #513710, region 1</title>
    </path>
  </g>
  <g id="color-layer-02" data-layer-name="Ink #040403 shapes" fill="#040403" fill-rule="nonzero">
    <title>Ink #040403 shapes</title>
    <path id="layer-02-path-001" data-element-name="Ink #040403, region 1" d="M 331.5 129 Q 332.5 129.5 332 131.5 Q 331.5 133.5 328.5 133 Q 327.5 132.5 328.5 132 Q 330.5 132.5 331 131.5 Q 330.5 129.5 331.5 129 Z ">
      <title>Ink #040403, region 1</title>
    </path>
    <path id="layer-02-path-002" data-element-name="Ink #040403, region 2" d="M 282.5 161 L 283.5 161 L 286.5 164 Q 289.5 163.5 290 165.5 L 290 169.5 L 291 170.5 L 291 171.5 L 292 172.5 L 292 173.5 Q 293.25 173.75 293 175.5 L 297 179.5 L 297 181.5 L 296 182.5 L 296 184.5 L 294 187.5 L 294 190.5 L 293 191.5 Q 293.5 194 292 194.5 L 292 197.5 L 291 198.5 L 291 204.5 L 289.5 206 L 288 204.5 L 288 203.5 L 287 202.5 L 287 201.5 L 285 198.5 L 285 196.5 L 283 193.5 L 283 190.5 L 282 189.5 Q 282.75 186.25 281 185.5 L 281 180.5 L 280 179.5 L 280 170.5 L 281 169.5 L 281 162.5 L 282.5 161 Z ">
      <title>Ink #040403, region 2</title>
    </path>
    <path id="layer-02-path-003" data-element-name="Ink #040403, region 3" d="M 347.5 594 Q 348.25 594.25 348 595.5 Q 347.5 596.5 347 595.5 Q 346.75 594.25 347.5 594 Z ">
      <title>Ink #040403, region 3</title>
    </path>
    <path id="layer-02-path-004" data-element-name="Ink #040403, region 4" d="M 346.5 597 L 347 597.5 L 347 600.5 L 346.5 601 L 345 599.5 L 346 598.5 Q 345.75 597.25 346.5 597 Z ">
      <title>Ink #040403, region 4</title>
    </path>
  </g>
  <g id="color-layer-03" data-layer-name="Neutral #4A3E3C shapes" fill="#4A3E3C" fill-rule="nonzero">
    <title>Neutral #4A3E3C shapes</title>
    <path id="layer-03-path-001" data-element-name="Neutral #4A3E3C, region 1" d="M 294.5 176 L 296 177.5 L 295.5 178 L 294 176.5 L 294.5 176 Z ">
      <title>Neutral #4A3E3C, region 1</title>
    </path>
    <path id="layer-03-path-002" data-element-name="Neutral #4A3E3C, region 2" d="M 281.5 187 Q 282.25 187.25 282 188.5 Q 281.5 189.5 281 188.5 Q 280.75 187.25 281.5 187 Z ">
      <title>Neutral #4A3E3C, region 2</title>
    </path>
    <path id="layer-03-path-003" data-element-name="Neutral #4A3E3C, region 3" d="M 291.5 200 Q 292.25 200.25 292 201.5 Q 291.5 202.5 291 201.5 Q 290.75 200.25 291.5 200 Z ">
      <title>Neutral #4A3E3C, region 3</title>
    </path>
    <path id="layer-03-path-004" data-element-name="Neutral #4A3E3C, region 4" d="M 421.5 373 L 422.5 373 L 424 374.5 L 424 375.5 L 429 380.5 L 429 381.5 L 434.5 387 L 437.5 387 L 440 384.5 L 440 379.5 L 441.5 378 L 442.5 378 L 444 379.5 L 444 380.5 L 445 381.5 L 445 382.5 Q 446.25 382.75 446 384.5 L 449.5 388 Q 451.25 387.75 451.5 389 L 454 386.5 L 454 383.5 L 453 382.5 L 453 378.5 L 452 377.5 L 452 375.5 Q 450.75 375.25 451 373.5 Q 451.25 372.75 452.5 373 L 453 373.5 L 453 376.5 L 454 377.5 Q 453.75 378.75 454.5 379 Q 455.75 378.75 456 379.5 L 456 380.5 L 458 382.5 L 458 383.5 L 460.5 386 Q 462.25 385.75 462.5 387 L 463.5 386 L 464.5 387 L 465.5 386 L 466 386.5 L 466 387.5 Q 467.25 387.75 467 389.5 L 471 393.5 L 471 394.5 L 469.5 396 Q 466.25 395.25 465.5 397 L 456.5 397 L 455.5 396 Q 452.25 396.75 451.5 395 L 447.5 395 L 446.5 394 L 444.5 394 L 443.5 393 Q 441 393.5 440.5 392 L 435.5 392 L 434.5 391 L 427.5 391 Q 427.25 389.75 425.5 390 L 421.5 386 Q 420.25 386.25 420 385.5 L 420 384.5 L 422 381.5 L 422 379.5 L 421 378.5 L 421 373.5 L 421.5 373 Z ">
      <title>Neutral #4A3E3C, region 4</title>
    </path>
    <path id="layer-03-path-005" data-element-name="Neutral #4A3E3C, region 5" d="M 406.5 377 Q 407.25 377.25 407 378.5 Q 406.5 379.5 406 378.5 Q 405.75 377.25 406.5 377 Z ">
      <title>Neutral #4A3E3C, region 5</title>
    </path>
    <path id="layer-03-path-006" data-element-name="Neutral #4A3E3C, region 6" d="M 410.5 377 L 412 378.5 L 411.5 379 Q 410.25 379.25 410 378.5 Q 409.75 377.25 410.5 377 Z ">
      <title>Neutral #4A3E3C, region 6</title>
    </path>
    <path id="layer-03-path-007" data-element-name="Neutral #4A3E3C, region 7" d="M 415.5 382 Q 415.75 383.25 417.5 383 L 419 384.5 L 418.5 385 L 417.5 384 L 416.5 384 L 415 382.5 L 415.5 382 Z ">
      <title>Neutral #4A3E3C, region 7</title>
    </path>
    <path id="layer-03-path-008" data-element-name="Neutral #4A3E3C, region 8" d="M 487.5 389 Q 487.75 390.25 489.5 390 L 491.5 392 L 492.5 392 L 494.5 394 L 495.5 394 Q 495.75 395.25 497.5 395 L 499 396.5 L 498.5 397 L 495.5 397 L 493.5 395 L 490.5 395 L 488 392.5 L 489 391.5 L 487 389.5 L 487.5 389 Z ">
      <title>Neutral #4A3E3C, region 8</title>
    </path>
    <path id="layer-03-path-009" data-element-name="Neutral #4A3E3C, region 9" d="M 504.5 399 L 506.5 401 Q 507.75 400.75 508 401.5 Q 507.75 402.25 506.5 402 L 504 399.5 L 504.5 399 Z ">
      <title>Neutral #4A3E3C, region 9</title>
    </path>
    <path id="layer-03-path-010" data-element-name="Neutral #4A3E3C, region 10" d="M 509.5 402 L 511.5 404 L 512.5 404 L 517.5 409 L 518.5 409 L 522 412.5 Q 522.25 413.75 521.5 414 L 519.5 414 Q 519.25 412.75 517.5 413 L 514 409.5 L 514 408.5 L 512 406.5 Q 512.25 405.25 511.5 405 L 510.5 405 L 509 403.5 Q 508.75 402.25 509.5 402 Z ">
      <title>Neutral #4A3E3C, region 10</title>
    </path>
    <path id="layer-03-path-011" data-element-name="Neutral #4A3E3C, region 11" d="M 344.5 590 L 346 591.5 L 345.5 592 L 344 590.5 L 344.5 590 Z ">
      <title>Neutral #4A3E3C, region 11</title>
    </path>
    <path id="layer-03-path-012" data-element-name="Neutral #4A3E3C, region 12" d="M 348.5 592 Q 349.25 592.25 349 593.5 Q 348.5 594.5 348 593.5 Q 347.75 592.25 348.5 592 Z ">
      <title>Neutral #4A3E3C, region 12</title>
    </path>
    <path id="layer-03-path-013" data-element-name="Neutral #4A3E3C, region 13" d="M 344.5 594 L 345 594.5 L 345 598.5 Q 344.5 599.5 344 598.5 L 344 594.5 L 344.5 594 Z ">
      <title>Neutral #4A3E3C, region 13</title>
    </path>
    <path id="layer-03-path-014" data-element-name="Neutral #4A3E3C, region 14" d="M 347.5 597 Q 348.25 597.25 348 598.5 Q 347.5 599.5 347 598.5 Q 346.75 597.25 347.5 597 Z ">
      <title>Neutral #4A3E3C, region 14</title>
    </path>
    <path id="layer-03-path-015" data-element-name="Neutral #4A3E3C, region 15" d="M 356.5 597 Q 357.25 597.25 357 598.5 Q 356.5 599.5 356 598.5 Q 355.75 597.25 356.5 597 Z ">
      <title>Neutral #4A3E3C, region 15</title>
    </path>
    <path id="layer-03-path-016" data-element-name="Neutral #4A3E3C, region 16" d="M 352.5 599 Q 353.5 599.5 353 601.5 Q 352.5 602.5 352 601.5 Q 351.5 599.5 352.5 599 Z ">
      <title>Neutral #4A3E3C, region 16</title>
    </path>
    <path id="layer-03-path-017" data-element-name="Neutral #4A3E3C, region 17" d="M 346.5 602 Q 347.25 602.25 347 603.5 L 345.5 605 L 345 604.5 L 346 603.5 Q 345.75 602.25 346.5 602 Z ">
      <title>Neutral #4A3E3C, region 17</title>
    </path>
  </g>
  <g id="color-layer-04" data-layer-name="Red #FA9590 shapes" fill="#FA9590" fill-rule="nonzero">
    <title>Red #FA9590 shapes</title>
    <path id="layer-04-path-001" data-element-name="Red #FA9590, region 1" d="M 332.5 111 L 340.5 111 L 341.5 112 L 345.5 112 L 348.5 114 L 350.5 114 L 353.5 117 L 354.5 117 L 367 129.5 L 367 130.5 L 369 132.5 L 369 133.5 L 370 134.5 L 370 135.5 L 371 136.5 L 371 137.5 L 372 138.5 L 372 139.5 L 373 140.5 L 373 141.5 L 374 142.5 L 374 143.5 L 376 146.5 L 376 149.5 L 377 150.5 Q 376.5 153 378 153.5 L 378 156.5 L 379 157.5 L 379 162.5 L 380 163.5 L 380 185.5 L 379 186.5 L 379 191.5 L 378 192.5 L 378 195.5 L 377 196.5 Q 377.5 199 376 199.5 L 376 202.5 L 374 205.5 L 374 207.5 L 372 210.5 L 372 212.5 L 371 213.5 L 371 214.5 L 370 215.5 L 370 216.5 L 369 217.5 L 369 218.5 L 368 219.5 L 368 220.5 L 367 221.5 L 367 222.5 L 366 223.5 L 366 224.5 L 365 225.5 L 365 226.5 Q 363.75 226.75 364 228.5 L 362 230.5 L 362 231.5 L 360 233.5 L 360 234.5 Q 358.75 234.75 359 236.5 L 357 238.5 L 357 239.5 L 353 244.5 L 353 245.5 Q 351.75 245.75 352 247.5 L 349 250.5 L 349 251.5 L 347 253.5 L 347 254.5 L 345 256.5 L 345 257.5 L 343 259.5 L 343 260.5 L 340 263.5 L 340 264.5 L 339 265.5 L 339 266.5 L 338 267.5 L 338 268.5 Q 336.75 268.75 337 270.5 L 335 272.5 L 335 273.5 L 334 274.5 L 334 275.5 L 333 276.5 L 333 277.5 L 332 278.5 L 332 279.5 L 330 282.5 L 330 284.5 L 328 287.5 L 328 289.5 L 327 290.5 L 327 292.5 L 326 293.5 Q 326.5 296 325 296.5 L 325 301.5 L 324 302.5 L 324 309.5 Q 325.25 309.75 325 311.5 L 327.5 314 L 331.5 314 L 340.5 305 L 341.5 305 L 346.5 301 L 347.5 301 L 348.5 300 L 349.5 300 L 352.5 298 L 355.5 298 L 358.5 296 L 362.5 296 L 363.5 295 Q 366.75 295.75 367.5 294 L 389.5 294 L 390.5 295 L 393.5 295 L 394.5 296 L 398.5 296 L 399.5 297 Q 402 296.5 402.5 298 L 405.5 298 L 408.5 300 L 410.5 300 L 411.5 301 L 412.5 301 L 413.5 302 L 414.5 302 L 415.5 303 L 416.5 303 Q 416.75 304.25 418.5 304 L 420.5 306 L 421.5 306 Q 421.75 307.25 423.5 307 L 425.5 309 L 426.5 309 Q 426.75 310.25 428.5 310 L 431.5 313 L 432.5 313 L 433.5 314 L 434.5 314 L 435.5 315 L 436.5 315 Q 436.75 316.25 438.5 316 L 443.5 320 L 444.5 320 L 445.5 321 L 446.5 321 Q 446.75 322.25 448.5 322 L 453.5 326 L 454.5 326 Q 454.75 327.25 456.5 327 L 458.5 329 L 459.5 329 L 462.5 332 L 463.5 332 L 467.5 336 L 468.5 336 L 472.5 340 L 473.5 340 L 484.5 351 L 485.5 351 L 487 352.5 L 487 353.5 L 493 359.5 L 493 360.5 L 496 363.5 L 496 364.5 L 499 367.5 L 499 368.5 L 500 369.5 L 500 370.5 L 501 371.5 L 501 372.5 Q 502.25 372.75 502 374.5 L 504 376.5 L 504 377.5 L 510 383.5 L 510 384.5 L 514 388.5 L 514 389.5 L 516 391.5 L 516 392.5 L 518 394.5 L 518 395.5 L 520 397.5 L 520 398.5 L 524 403.5 L 524 404.5 Q 525.25 404.75 525 406.5 L 527 408.5 L 527 409.5 L 528 410.5 L 528 411.5 L 529 412.5 L 529 413.5 L 530 414.5 L 530 415.5 L 532 418.5 Q 531.25 421.75 533 422.5 L 533 428.5 L 532 429.5 Q 532.5 431.5 531.5 432 L 530.5 432 L 529 430.5 L 529 429.5 L 528 428.5 L 528 427.5 L 527 426.5 L 527 425.5 L 525 422.5 L 527 421.5 L 527 417.5 L 514.5 405 L 513.5 405 L 511.5 403 L 510.5 403 L 505.5 399 L 504.5 399 Q 504.25 397.75 502.5 398 L 500.5 396 L 499.5 396 L 498.5 395 L 497.5 395 Q 497.25 393.75 495.5 394 L 490.5 390 Q 488.75 390.25 488.5 389 L 485.5 389 L 483 391.5 L 483 392.5 L 481.5 394 Q 479.75 393.75 479.5 395 L 475.5 395 L 474.5 394 L 473.5 394 Q 473.25 392.75 471.5 393 L 467 388.5 L 467 387.5 L 465.5 386 Q 463.75 386.25 463.5 385 L 462.5 387 L 458 382.5 L 458 381.5 L 456 379.5 L 456 378.5 L 455 377.5 L 455 376.5 Q 453.75 376.25 454 374.5 L 452.5 373 L 451.5 373 L 450 374.5 L 452 377.5 L 452 382.5 L 453 383.5 L 453 387.5 L 451.5 389 L 450.5 388 L 449.5 388 L 448 386.5 L 448 385.5 L 446 383.5 L 446 382.5 Q 444.75 382.25 445 380.5 L 442.5 378 L 441.5 378 L 440 379.5 L 440 384.5 L 437.5 387 L 435.5 387 L 429 380.5 L 429 379.5 L 425 375.5 L 425 374.5 L 423.5 373 Q 420.5 372.5 420 374.5 Q 419.75 376.25 421 376.5 L 421 382.5 L 420.5 383 L 416.5 383 L 409.5 376 L 407.5 376 L 405 378.5 L 405.5 379 Q 406.75 378.75 407 379.5 L 406.5 380 L 401.5 380 L 398.5 378 L 388.5 378 L 385.5 376 L 382.5 376 Q 382 374.5 379.5 375 L 373.5 371 Q 372.75 372.75 369.5 372 L 366.5 374 L 352.5 374 L 351.5 375 L 350.5 375 L 349.5 376 L 348.5 376 Q 348.25 377.25 346.5 377 L 340 383.5 L 340 384.5 L 336 388.5 Q 336.25 390.25 335 390.5 L 335 393.5 Q 336.25 393.75 336 395.5 Q 335.5 396.5 335 395.5 Q 335.25 394.25 334.5 394 L 333.5 395 L 331.5 393 L 330.5 393 L 328.5 391 L 327.5 391 L 324.5 388 L 323.5 388 L 319.5 384 L 318.5 384 L 310 375.5 L 310 374.5 L 306 370.5 L 306 369.5 L 302 364.5 L 302 363.5 L 301 362.5 L 301 361.5 L 300 360.5 L 300 359.5 L 299 358.5 L 299 357.5 L 298 356.5 L 298 355.5 L 296 352.5 Q 296.5 350 295 349.5 L 295 346.5 L 294 345.5 L 294 342.5 L 293 341.5 L 293 336.5 L 292 335.5 L 292 321.5 L 293 320.5 L 293 313.5 L 294 312.5 L 294 307.5 L 295 306.5 Q 294.5 304 296 303.5 L 296 300.5 L 298 297.5 L 298 295.5 L 300 292.5 L 300 290.5 L 302 287.5 L 302 285.5 L 303 284.5 L 303 283.5 L 304 282.5 L 304 281.5 Q 305.25 281.25 305 279.5 L 307 277.5 L 307 276.5 L 308 275.5 L 308 274.5 Q 309.25 274.25 309 272.5 L 311 270.5 L 311 269.5 Q 312.25 269.25 312 267.5 L 314 265.5 L 314 264.5 L 316 262.5 L 316 261.5 L 319 258.5 L 319 257.5 L 321 255.5 L 321 254.5 L 324 251.5 L 324 250.5 L 327 247.5 L 327 246.5 L 330 243.5 L 330 242.5 L 334 238.5 L 334 237.5 L 336 235.5 L 336 234.5 L 339 231.5 L 339 230.5 L 342 227.5 L 342 226.5 L 346 222.5 L 346 221.5 L 347 220.5 L 347 219.5 Q 348.25 219.25 348 217.5 L 352 212.5 L 352 211.5 Q 353.25 211.25 353 209.5 L 355 207.5 L 355 206.5 L 357 203.5 L 357 201.5 L 358 200.5 L 358 199.5 L 360 196.5 L 360 193.5 L 362 190.5 L 362 186.5 L 363 185.5 L 363 172.5 Q 361.25 171.75 362 168.5 L 361 167.5 L 361 166.5 L 360 165.5 L 360 164.5 L 359 163.5 L 359 162.5 Q 357.75 162.25 358 160.5 L 352.5 155 L 351.5 155 L 348.5 153 L 343.5 153 L 342.5 154 L 340.5 154 L 339.5 155 L 338.5 155 L 337.5 156 L 336.5 156 L 333.5 158 L 331.5 158 L 330.5 159 Q 328 158.5 327.5 160 L 318.5 160 L 318 159.5 L 319 158.5 L 318 157.5 L 318 154.5 L 319 153.5 Q 318.25 150.25 320 149.5 L 320 139.5 L 316.5 136 L 311.5 136 L 310.5 135 L 308.5 135 L 307.5 134 Q 306.25 134.25 306 133.5 Q 305.75 131.75 307 131.5 L 307 129.5 L 308 128.5 L 308 127.5 Q 309.25 127.25 309 125.5 L 311 123.5 L 311 122.5 L 316.5 116 Z M 330 123 L 327 126 Q 327 128 328 129 Q 327 129 327 132 L 330 134 L 331 134 L 332 133 L 332 132 L 334 130 L 333 129 Q 333 128 335 128 L 336 129 L 338 127 Q 337 126 337 125 Q 337 124 336 124 L 335 123 L 330 123 Z ">
      <title>Red #E0576F, region 2</title>
    </path>
    <path id="layer-08-path-003" data-element-name="Red #E0576F, region 3" d="M 423.5 373 L 425 374.5 L 425 375.5 L 429 379.5 L 428.5 380 L 424 375.5 Q 424.25 373.75 423 373.5 L 423.5 373 Z ">
      <title>Red #E0576F, region 3</title>
    </path>
    <path id="layer-08-path-004" data-element-name="Red #E0576F, region 4" d="M 420.5 374 Q 421.25 374.25 421 375.5 Q 420.5 376.5 420 375.5 Q 419.75 374.25 420.5 374 Z ">
      <title>Red #E0576F, region 4</title>
    </path>
    <path id="layer-08-path-005" data-element-name="Red #E0576F, region 5" d="M 450.5 374 L 452 375.5 L 452 376.5 Q 451.5 377.5 451 376.5 Q 451.25 374.75 450 374.5 L 450.5 374 Z ">
      <title>Red #E0576F, region 5</title>
    </path>
    <path id="layer-08-path-006" data-element-name="Red #E0576F, region 6" d="M 453.5 374 Q 454.25 374.25 454 375.5 L 455 376.5 L 455 377.5 L 456 378.5 L 455.5 379 L 454 377.5 Q 454.25 375.75 453 375.5 Q 452.75 374.25 453.5 374 Z ">
      <title>Red #E0576F, region 6</title>
    </path>
    <path id="layer-08-path-007" data-element-name="Red #E0576F, region 7" d="M 407.5 376 L 408.5 378 Q 409.75 377.75 410 378.5 Q 409.75 378.25 408.5 378 Q 407.5 377.5 407.5 376 Z ">
      <title>Red #E0576F, region 7</title>
    </path>
    <path id="layer-08-path-008" data-element-name="Red #E0576F, region 8" d="M 452.5 378 L 453 378.5 L 453 382.5 L 454 383.5 L 454 386.5 Q 453.5 387.5 453 386.5 Q 453.75 383.25 452 382.5 L 452 378.5 L 452.5 378 Z ">
      <title>Red #E0576F, region 8</title>
    </path>
    <path id="layer-08-path-009" data-element-name="Red #E0576F, region 9" d="M 411.5 379 L 412.5 379 L 415 381.5 Q 414.75 383.25 416 383.5 L 415.5 384 L 411 379.5 L 411.5 379 Z ">
      <title>Red #E0576F, region 9</title>
    </path>
    <path id="layer-08-path-010" data-element-name="Red #E0576F, region 10" d="M 421.5 379 Q 422.5 379.5 422 381.5 Q 421.5 382.5 421 381.5 Q 420.5 379.5 421.5 379 Z ">
      <title>Red #E0576F, region 10</title>
    </path>
    <path id="layer-08-path-011" data-element-name="Red #E0576F, region 11" d="M 456.5 380 L 458 381.5 L 457.5 382 L 456 380.5 L 456.5 380 Z ">
      <title>Red #E0576F, region 11</title>
    </path>
    <path id="layer-08-path-012" data-element-name="Red #E0576F, region 12" d="M 429.5 381 L 435 386.5 L 434.5 387 L 429 381.5 L 429.5 381 Z ">
      <title>Red #E0576F, region 12</title>
    </path>
    <path id="layer-08-path-013" data-element-name="Red #E0576F, region 13" d="M 418.5 383 Q 420.5 382.5 421 383.5 Q 420.5 384.5 418.5 384 L 417.5 385 L 417 384.5 L 418.5 383 Z ">
      <title>Red #E0576F, region 13</title>
    </path>
    <path id="layer-08-path-014" data-element-name="Red #E0576F, region 14" d="M 458.5 383 L 461 385.5 L 460.5 386 L 458 383.5 L 458.5 383 Z ">
      <title>Red #E0576F, region 14</title>
    </path>
    <path id="layer-08-path-015" data-element-name="Red #E0576F, region 15" d="M 446.5 384 L 448 385.5 L 447.5 386 L 446 384.5 L 446.5 384 Z ">
      <title>Red #E0576F, region 15</title>
    </path>
    <path id="layer-08-path-016" data-element-name="Red #E0576F, region 16" d="M 463.5 385 L 465 386.5 L 464.5 387 L 463 385.5 L 463.5 385 Z ">
      <title>Red #E0576F, region 16</title>
    </path>
    <path id="layer-08-path-017" data-element-name="Red #E0576F, region 17" d="M 421.5 386 L 423 387.5 L 422.5 388 L 421 386.5 L 421.5 386 Z ">
      <title>Red #E0576F, region 17</title>
    </path>
    <path id="layer-08-path-018" data-element-name="Red #E0576F, region 18" d="M 490.5 390 L 492 391.5 L 491.5 392 L 490 390.5 L 490.5 390 Z ">
      <title>Red #E0576F, region 18</title>
    </path>
    <path id="layer-08-path-019" data-element-name="Red #E0576F, region 19" d="M 430.5 391 L 434.5 391 L 435 391.5 L 434.5 392 L 430.5 392 Q 429.5 391.5 430.5 391 Z ">
      <title>Red #E0576F, region 19</title>
    </path>
    <path id="layer-08-path-020" data-element-name="Red #E0576F, region 20" d="M 493.5 392 L 495 393.5 L 494.5 394 L 493 392.5 L 493.5 392 Z ">
      <title>Red #E0576F, region 20</title>
    </path>
    <path id="layer-08-path-021" data-element-name="Red #E0576F, region 21" d="M 450.5 395 Q 451.75 394.75 452 395.5 Q 451.75 396.25 450.5 396 Q 449.5 395.5 450.5 395 Z ">
      <title>Red #E0576F, region 21</title>
    </path>
    <path id="layer-08-path-022" data-element-name="Red #E0576F, region 22" d="M 453.5 396 Q 455.5 395.5 456 396.5 Q 455.5 397.5 453.5 397 Q 452.5 396.5 453.5 396 Z ">
      <title>Red #E0576F, region 22</title>
    </path>
    <path id="layer-08-path-023" data-element-name="Red #E0576F, region 23" d="M 514.5 405 L 518 408.5 L 517.5 409 L 514 405.5 L 514.5 405 Z ">
      <title>Red #E0576F, region 23</title>
    </path>
    <path id="layer-08-path-024" data-element-name="Red #E0576F, region 24" d="M 454.5 450 L 456.5 452 L 457.5 452 L 462.5 457 L 463.5 457 L 466.5 460 L 467.5 460 L 471.5 464 L 472.5 464 L 474.5 466 L 475.5 466 Q 475.75 467.25 477.5 467 L 480.5 470 L 481.5 470 L 482.5 471 L 483.5 471 Q 483.75 472.25 485.5 472 L 487.5 474 Q 488.75 473.75 489 474.5 Q 488.75 475.75 489.5 476 Q 490.75 475.75 491 476.5 L 491 477.5 L 493 479.5 L 493 482.5 Q 491.75 482.75 492 484.5 L 490 486.5 L 490 487.5 L 488.5 489 L 487.5 489 L 484.5 491 L 482.5 491 L 481.5 492 L 480.5 492 L 477.5 494 L 475.5 494 L 474.5 495 L 473.5 495 Q 473.25 496.25 471.5 496 L 469.5 498 L 468.5 498 L 467.5 499 L 466.5 499 L 465.5 500 L 464.5 500 L 461.5 502 L 458.5 502 Q 457.5 501.5 458 499.5 L 457 498.5 L 458 497.5 Q 457.5 495.5 458.5 495 L 459.5 495 L 460.5 494 Q 461.75 494.25 462 493.5 Q 461.75 492.25 462.5 492 L 463.5 492 Q 463.75 490.75 465.5 491 L 467.5 489 L 468.5 489 L 469.5 488 L 470.5 488 Q 470.75 486.75 472.5 487 L 475 484.5 Q 474.75 482.75 476 482.5 L 476 479.5 L 475 478.5 L 475 476.5 L 474 475.5 L 474 474.5 Q 472.75 474.25 473 472.5 L 469 468.5 L 469 467.5 L 467.5 466 L 465.5 466 L 459.5 460 L 458.5 460 L 457 458.5 L 457 457.5 L 454 454.5 L 454 450.5 L 454.5 450 Z ">
      <title>Red #E0576F, region 24</title>
    </path>
    <path id="layer-08-path-025" data-element-name="Red #E0576F, region 25" d="M 393.5 467 L 394 467.5 L 394 470.5 Q 393.5 471.5 393 470.5 L 393 467.5 L 393.5 467 Z ">
      <title>Red #E0576F, region 25</title>
    </path>
    <path id="layer-08-path-026" data-element-name="Red #E0576F, region 26" d="M 449.5 502 L 450.5 503 Q 451.75 502.75 452 503.5 Q 452.5 505.5 451.5 506 Q 450.25 505.75 450 506.5 Q 450.25 507.75 449.5 508 L 447 505.5 L 447 503.5 Q 447.25 502.75 448.5 503 L 449.5 502 Z ">
      <title>Red #E0576F, region 26</title>
    </path>
    <path id="layer-08-path-027" data-element-name="Red #E0576F, region 27" d="M 435.5 509 Q 436.5 511 437.5 509 L 440 511.5 Q 440.25 512.75 439.5 513 L 438.5 513 L 435.5 515 L 434.5 514 L 430.5 514 L 430 513.5 Q 429.75 512.25 430.5 512 L 431.5 512 L 433.5 510 Q 435.25 510.25 435.5 509 Z ">
      <title>Red #E0576F, region 27</title>
    </path>
    <path id="layer-08-path-028" data-element-name="Red #E0576F, region 28" d="M 394.5 511 L 395 511.5 L 395 514.5 Q 394.5 515.5 394 514.5 L 394 511.5 L 394.5 511 Z ">
      <title>Red #E0576F, region 28</title>
    </path>
    <path id="layer-08-path-029" data-element-name="Red #E0576F, region 29" d="M 422.5 517 Q 424.5 516.5 425 517.5 Q 425.75 521.25 423.5 522 Q 421.75 521.75 421.5 523 L 420.5 522 Q 419.25 522.25 419 521.5 Q 419.25 519.75 418 519.5 Q 418.25 518.75 419.5 519 L 420.5 518 L 421.5 518 L 422.5 517 Z ">
      <title>Red #E0576F, region 29</title>
    </path>
    <path id="layer-08-path-030" data-element-name="Red #E0576F, region 30" d="M 393.5 527 Q 394.5 527.5 394 529.5 Q 393.5 530.5 393 529.5 Q 392.5 527.5 393.5 527 Z ">
      <title>Red #E0576F, region 30</title>
    </path>
    <path id="layer-08-path-031" data-element-name="Red #E0576F, region 31" d="M 397.5 533 L 402.5 533 L 403 533.5 L 403 540.5 Q 404.25 540.75 404 542.5 Q 403.75 543.25 402.5 543 Q 402 541.5 399.5 542 Q 399.25 543.25 397.5 543 L 393 547.5 L 393 554.5 L 392.5 555 L 392 554.5 L 392 545.5 L 391 544.5 Q 391.25 543.25 390.5 543 L 389.5 543 Q 389.25 541.75 387.5 542 L 385.5 544 L 385 543.5 L 387 541.5 L 387 538.5 L 386.5 538 L 385.5 539 Q 384.25 539.25 384 538.5 Q 384.25 537.75 385.5 538 L 386.5 537 Q 386.75 538.25 388.5 538 L 389 537.5 L 388 536.5 L 388.5 536 Q 389 537.5 391.5 537 L 397.5 533 Z ">
      <title>Red #E0576F, region 31</title>
    </path>
    <path id="layer-08-path-032" data-element-name="Red #E0576F, region 32" d="M 382.5 539 L 383 539.5 L 382 540.5 L 382 541.5 L 384 543.5 L 384 544.5 Q 383.75 545.25 382.5 545 L 380.5 547 L 379.5 547 Q 379.25 548.25 377.5 548 L 374 551.5 L 374 552.5 L 371 555.5 L 371 556.5 L 369 558.5 L 369 559.5 L 367 562.5 L 367 564.5 L 366 565.5 L 366 566.5 L 365 567.5 L 365 568.5 Q 363.75 568.75 364 570.5 L 362 572.5 L 362 573.5 L 360 575.5 Q 360.25 577.25 359 577.5 Q 359.5 580 358 580.5 L 358 583.5 L 357 584.5 L 357 593.5 L 356.5 594 L 351.5 594 L 351 593.5 Q 352.75 592.75 352 589.5 L 350.5 588 L 349.5 588 Q 348.75 588.25 349 589.5 L 348 590.5 L 349 591.5 L 348.5 592 Q 346.5 592.5 346 591.5 L 347 590.5 L 346.5 590 Q 345.25 590.25 345 589.5 L 345 583.5 L 346 582.5 Q 345.75 580.75 347 580.5 L 347 578.5 L 348 577.5 L 348 576.5 L 350 573.5 L 350 571.5 L 351 570.5 Q 350.5 568 352 567.5 L 352 564.5 L 354 562.5 L 354 561.5 L 356 558.5 L 356 556.5 Q 357.25 556.25 357 554.5 L 359 552.5 L 359 551.5 L 360.5 550 L 361.5 550 L 364.5 548 L 366.5 548 L 367.5 547 L 368.5 547 L 369.5 546 L 370.5 546 L 371.5 545 L 372.5 545 L 373.5 544 L 374.5 544 L 375.5 543 L 376.5 543 L 377.5 542 L 378.5 542 Q 378.75 540.75 380.5 541 L 382.5 539 Z ">
      <title>Red #E0576F, region 32</title>
    </path>
    <path id="layer-08-path-033" data-element-name="Red #E0576F, region 33" d="M 392.5 587 L 393 587.5 L 393 590.5 Q 392.5 591.5 392 590.5 L 392 587.5 L 392.5 587 Z ">
      <title>Red #E0576F, region 33</title>
    </path>
    <path id="layer-08-path-034" data-element-name="Red #E0576F, region 34" d="M 395.5 604 Q 396.5 604.5 396 606.5 Q 395.5 607.5 395 606.5 Q 394.5 604.5 395.5 604 Z ">
      <title>Red #E0576F, region 34</title>
    </path>
    <path id="layer-08-path-035" data-element-name="Red #E0576F, region 35" d="M 391.5 617 L 392 617.5 L 392 621.5 Q 391.5 622.5 391 621.5 L 391 617.5 L 391.5 617 Z ">
      <title>Red #E0576F, region 35</title>
    </path>
    <path id="layer-08-path-036" data-element-name="Red #E0576F, region 36" d="M 394.5 622 Q 395.25 622.25 395 623.5 Q 394.5 624.5 394 623.5 Q 393.75 622.25 394.5 622 Z ">
      <title>Red #E0576F, region 36</title>
    </path>
    <path id="layer-08-path-037" data-element-name="Red #E0576F, region 37" d="M 393.5 645 L 394 645.5 L 394 675.5 L 395 676.5 Q 394.25 679.75 396 680.5 L 396 687.5 L 391.5 692 L 385.5 692 L 384.5 693 L 369.5 693 L 368.5 694 L 360.5 694 L 359.5 695 L 354.5 695 Q 354 696.5 351.5 696 L 349.5 694 L 348.5 695 L 348 694.5 L 348 692.5 Q 346.5 692 L 347 689.5 L 347.5 689 L 353.5 689 L 354.5 688 L 361.5 688 L 362.5 687 Q 365.75 687.75 366.5 686 L 370.5 686 L 371.5 685 Q 374 685.5 374.5 684 L 377.5 684 L 378.5 683 L 379.5 683 Q 379.75 681.75 381.5 682 L 384 679.5 L 384 678.5 L 386 675.5 Q 385.25 672.25 387 671.5 L 387 667.5 L 388 666.5 L 388 657.5 L 389 656.5 L 389 649.5 L 389.5 649 L 390 649.5 Q 389.5 651.5 390.5 652 L 391.5 651 L 392.5 652 L 393 651.5 L 393 645.5 L 393.5 645 Z ">
      <title>Red #E0576F, region 37</title>
    </path>
  </g>
  <g id="color-layer-09" data-layer-name="Red #291115 shapes" fill="#291115" fill-rule="nonzero">
    <title>Red #291115 shapes</title>
    <path id="layer-09-path-001" data-element-name="Red #291115, region 1" d="M 329.5 129 Q 330.75 128.75 331 129.5 L 329 130.5 Q 329.25 131.75 328.5 132 Q 327.25 132.25 327 131.5 L 329.5 129 Z ">
      <title>Red #291115, region 1</title>
    </path>
    <path id="layer-09-path-002" data-element-name="Red #291115, region 2" d="M 282.5 160 L 283 160.5 L 281.5 162 L 281 161.5 L 282.5 160 Z ">
      <title>Red #291115, region 2</title>
    </path>
    <path id="layer-09-path-003" data-element-name="Red #291115, region 3" d="M 280.5 166 L 281 166.5 L 281 169.5 Q 280.5 170.5 280 169.5 L 280 166.5 L 280.5 166 Z ">
      <title>Red #291115, region 3</title>
    </path>
    <path id="layer-09-path-004" data-element-name="Red #291115, region 4" d="M 280.5 180 Q 281.25 180.25 281 181.5 Q 280.5 182.5 280 181.5 Q 279.75 180.25 280.5 180 Z ">
      <title>Red #291115, region 4</title>
    </path>
    <path id="layer-09-path-005" data-element-name="Red #291115, region 5" d="M 291.5 198 Q 292.25 198.25 292 199.5 Q 291.5 200.5 291 199.5 Q 290.75 198.25 291.5 198 Z ">
      <title>Red #291115, region 5</title>
    </path>
    <path id="layer-09-path-006" data-element-name="Red #291115, region 6" d="M 347.5 592 Q 348.25 592.25 348 593.5 Q 346.75 593.75 347 595.5 L 348 596.5 L 347.5 597 Q 346.25 596.75 346 597.5 Q 346.25 598.75 345.5 599 L 345 598.5 L 345 593.5 Q 345.25 592.75 346.5 593 L 347.5 592 Z ">
      <title>Red #291115, region 6</title>
    </path>
    <path id="layer-09-path-007" data-element-name="Red #291115, region 7" d="M 352.5 594 L 353.5 595 L 356.5 595 L 357 595.5 L 356 596.5 L 356 601.5 L 355 602.5 L 355 603.5 L 354 604.5 Q 354.25 605.75 353.5 606 L 353 605.5 L 353 599.5 L 352 598.5 L 352 594.5 L 352.5 594 Z ">
      <title>Red #291115, region 7</title>
    </path>
    <path id="layer-09-path-008" data-element-name="Red #291115, region 8" d="M 345.5 600 L 347 601.5 L 346.5 602 Q 345.25 602.25 345 601.5 Q 344.75 600.25 345.5 600 Z ">
      <title>Red #291115, region 8</title>
    </path>
  </g>
</svg>`;

const SAMPLE_RESULT: VectorizeResult = {
  svg: SAMPLE_SVG,
  paths: 9,
  groups: 4,
  width: 768,
  height: 768,
  palette: ["#513710", "#040403", "#4A3E3C", "#FA9590", "#551322", "#A8A9A6", "#F3D7D5", "#E0576F", "#291115"],
  duration: 0,
};

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function downloadText(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "image/svg+xml" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitizeEditedSvg(source: string) {
  const documentNode = new DOMParser().parseFromString(source, "image/svg+xml");
  if (documentNode.querySelector("parsererror") || documentNode.documentElement.tagName.toLowerCase() !== "svg") {
    throw new Error("The source is not valid SVG markup.");
  }

  documentNode.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());
  documentNode.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "xlink:href") && value.startsWith("javascript:"))) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return new XMLSerializer().serializeToString(documentNode);
}

function getSvgMetrics(svg: string, previous: VectorizeResult) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = documentNode.documentElement;
  const viewBox = root.getAttribute("viewBox")?.split(/\s+/).map(Number);
  return {
    ...previous,
    svg,
    paths: documentNode.querySelectorAll("path").length,
    groups: documentNode.querySelectorAll("g").length,
    width: viewBox?.[2] || Number(root.getAttribute("width")) || previous.width,
    height: viewBox?.[3] || Number(root.getAttribute("height")) || previous.height,
  };
}

function SyntaxLine({ line }: { line: string }) {
  const parts: ReactNode[] = [];
  const tokenPattern = /(<!--.*?-->|<\/?[A-Za-z][\w:-]*|\/?>|[\w:-]+(?==)|="[^"]*")/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line)) !== null) {
    if (match.index > cursor) parts.push(line.slice(cursor, match.index));
    const token = match[0];
    let className = "code-punctuation";
    if (token.startsWith("<!--")) className = "code-comment";
    else if (token.startsWith("<")) className = "code-tag";
    else if (token.startsWith('="')) className = "code-value";
    else if (!token.includes(">")) className = "code-attribute";
    parts.push(
      <span className={className} key={`${match.index}-${token.slice(0, 12)}`}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }

  if (cursor < line.length) parts.push(line.slice(cursor));
  return <>{parts}</>;
}

function AppLogo() {
  return (
    <div className="brand-lockup" aria-label="Curvia home">
      <svg viewBox="0 0 34 34" aria-hidden="true">
        <path d="M7 25c0-10 4-16 13-16 4 0 7 2 8 5-3-1-7 0-9 2-3 3-4 7-3 11H7v-2Z" />
        <circle cx="24" cy="24" r="4" />
      </svg>
      <span>CURVIA</span>
    </div>
  );
}

function ApiKeyDialog({
  open,
  currentKey,
  onClose,
  onSave,
}: {
  open: boolean;
  currentKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
}) {
  const [value, setValue] = useState(currentKey);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) setValue(currentKey);
  }, [currentKey, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="api-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close settings">
          <X size={18} />
        </button>
        <div className="dialog-icon">
          <KeyRound size={22} />
        </div>
        <p className="eyebrow">CONNECTION</p>
        <h2 id="api-dialog-title">Connect Pollinations</h2>
        <p className="dialog-copy">
          Add a browser-safe publishable key. It is kept in this tab only and sent directly to Pollinations.
        </p>
        <label className="field-label" htmlFor="api-key">
          API key
        </label>
        <div className="key-input-wrap">
          <input
            id="api-key"
            type={visible ? "text" : "password"}
            value={value}
            placeholder="pk_..."
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setValue(event.target.value)}
          />
          <button onClick={() => setVisible((shown) => !shown)} aria-label={visible ? "Hide key" : "Show key"}>
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {value.trim().startsWith("sk_") && (
          <p className="security-warning">
            This is a secret server key. It will work for this session, but use a scoped pk_ key in a deployed browser app.
          </p>
        )}
        <div className="dialog-note">
          <Zap size={16} />
          <span>Flux handles text prompts. GPT Image 1 Mini is used only when a reference image is attached.</span>
        </div>
        <button
          className="primary-button dialog-save"
          disabled={!value.trim()}
          onClick={() => onSave(value.trim())}
        >
          Save for this session
          <Check size={18} />
        </button>
      </section>
    </div>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [rasterUrl, setRasterUrl] = useState("");
  const [svgCode, setSvgCode] = useState(SAMPLE_SVG);
  const [result, setResult] = useState<VectorizeResult>(SAMPLE_RESULT);
  const [settings, setSettings] = useState<VectorizeSettings>({
    colors: 16,
    detail: 5,
    smoothing: 5,
    removeBackground: true,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Ready");
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState<"vector" | "raster">("vector");
  const [zoom, setZoom] = useState(100);
  const [hoveredId, setHoveredId] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftCode, setDraftCode] = useState(SAMPLE_SVG);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("curvia-pollinations-key") || "");
  const [lastModel, setLastModel] = useState("Local sample");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const sourceBlobRef = useRef<Blob | null>(null);

  const codeLines = useMemo(() => svgCode.split("\n"), [svgCode]);
  const outputSize = useMemo(() => formatBytes(new Blob([svgCode]).size), [svgCode]);
  const artboardWidth = Math.round(520 * (zoom / 100));
  const artboardHeight = Math.round(artboardWidth * (result.height / result.width));

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll(".is-code-hovered").forEach((node) => node.classList.remove("is-code-hovered"));
    if (!hoveredId) return;
    const element = Array.from(root.querySelectorAll<SVGElement>("[id]")).find((node) => node.id === hoveredId);
    element?.classList.add("is-code-hovered");
  }, [hoveredId, svgCode]);

  useEffect(
    () => () => {
      if (referenceUrl) URL.revokeObjectURL(referenceUrl);
      if (rasterUrl) URL.revokeObjectURL(rasterUrl);
    },
    [referenceUrl, rasterUrl],
  );

  const runVectorizer = async (blob: Blob, currentSettings: VectorizeSettings) => {
    const vector = await vectorizeImage(blob, currentSettings, (nextProgress, label) => {
      setProgress(nextProgress);
      setProgressLabel(label);
    });
    setSvgCode(vector.svg);
    setDraftCode(vector.svg);
    setResult(vector);
    setPreviewMode("vector");
    return vector;
  };

  const acceptFile = async (file: File) => {
    setError("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Use a PNG, JPG, or WebP reference image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Reference images must be smaller than 15 MB.");
      return;
    }
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    setReference(file);
    const nextUrl = URL.createObjectURL(file);
    setReferenceUrl(nextUrl);

    if (rasterUrl) URL.revokeObjectURL(rasterUrl);
    setRasterUrl(nextUrl);
    sourceBlobRef.current = file;
    setLastModel("Uploaded reference");

    setRunning(true);
    setProgress(34);
    setProgressLabel("Analyzing uploaded reference and vectorizing");
    try {
      await runVectorizer(file, settings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local vectorizer could not process the upload.");
    } finally {
      setRunning(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) acceptFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const removeReference = () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    setReference(null);
    setReferenceUrl("");
  };

  const saveApiKey = (key: string) => {
    sessionStorage.setItem("curvia-pollinations-key", key);
    setApiKey(key);
    setSettingsOpen(false);
    setError("");
  };

  const handleCreate = async () => {
    if (!prompt.trim() && !reference) {
      setError("Describe an asset or attach a reference image first.");
      return;
    }
    if (!apiKey) {
      setError("Connect a Pollinations API key to generate an image.");
      setSettingsOpen(true);
      return;
    }

    setError("");
    setRunning(true);
    setProgress(8);
    setProgressLabel(reference ? "Sending reference to GPT Image" : "Generating a Flux source");
    try {
      const generated = await generateVectorSource({ prompt, reference, apiKey });
      sourceBlobRef.current = generated.blob;
      if (rasterUrl) URL.revokeObjectURL(rasterUrl);
      const nextRasterUrl = URL.createObjectURL(generated.blob);
      setRasterUrl(nextRasterUrl);
      setLastModel(generated.model);
      setProgress(34);
      setProgressLabel("Source ready, starting local trace");
      await runVectorizer(generated.blob, settings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The generation pipeline could not finish.");
      setProgress(0);
      setProgressLabel("Ready");
    } finally {
      setRunning(false);
    }
  };

  const handleRetrace = async () => {
    if (!sourceBlobRef.current) return;
    setRunning(true);
    setError("");
    setProgress(38);
    setProgressLabel("Rebuilding locally with new settings");
    try {
      await runVectorizer(sourceBlobRef.current, settings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local trace could not finish.");
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(svgCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const beginEditing = () => {
    setDraftCode(svgCode);
    setEditing(true);
  };

  const applyEdit = () => {
    try {
      const clean = sanitizeEditedSvg(draftCode);
      setSvgCode(clean);
      setResult((previous) => getSvgMetrics(clean, previous));
      setEditing(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The SVG source could not be applied.");
    }
  };

  const handlePreviewPointer = (target: EventTarget | null) => {
    if (!(target instanceof SVGElement)) return;
    const editable = target.closest<SVGElement>("[id]");
    if (editable?.id) setHoveredId(editable.id);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <AppLogo />
        <div className="topbar-center" aria-label="Pipeline status">
          <span className="status-dot" />
          <span>AI source</span>
          <span className="status-line" />
          <span>Local trace</span>
          <span className="status-line" />
          <span>Editable SVG</span>
        </div>
        <button className={`api-button ${apiKey ? "is-connected" : ""}`} onClick={() => setSettingsOpen(true)}>
          {apiKey ? <Check size={15} /> : <KeyRound size={15} />}
          {apiKey ? "API connected" : "Connect API"}
        </button>
      </header>

      <main className="workspace">
        <aside className="composer-panel">
          <div className="composer-heading reveal-one">
            <p className="eyebrow">NEW VECTOR</p>
            <h1>Shape an asset.</h1>
            <p>Start with an idea or a reference. Curvia makes the raster vector-friendly before tracing it locally.</p>
          </div>

          <div className="prompt-field reveal-two">
            <label className="field-label" htmlFor="asset-prompt">
              Describe the asset
              <span>{prompt.length}/500</span>
            </label>
            <textarea
              id="asset-prompt"
              value={prompt}
              maxLength={500}
              placeholder="E.g. A minimalist, geometric logo of a stylized owl, high contrast, 16 colors..."
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="prompt-footnote">
              <Sparkles size={14} />
              Flat style, crisp edges, editable layers, white background
            </div>
          </div>

          <div className="or-divider reveal-two">
            <span>OR ADD A REFERENCE</span>
          </div>

          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
          />

          {reference ? (
            <div className="reference-file reveal-three">
              <img src={referenceUrl} alt="Uploaded reference" />
              <div>
                <strong>{reference.name}</strong>
                <span>{formatBytes(reference.size)} / GPT Image route</span>
              </div>
              <button onClick={removeReference} aria-label="Remove reference image">
                <Trash2 size={17} />
              </button>
            </div>
          ) : (
            <button
              className={`drop-zone reveal-three ${dragging ? "is-dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <UploadCloud size={22} />
              <span>
                <strong>Drop image here</strong>
                PNG, JPG, or WebP up to 15 MB
              </span>
              <Plus size={17} />
            </button>
          )}

          <div className="route-line reveal-three">
            <div className="route-model-icon">{reference ? <ImageIcon size={17} /> : <Zap size={17} />}</div>
            <div>
              <span>Generation route</span>
              <strong>{reference ? "GPT Image 1 Mini / reference-aware" : "Flux Schnell / low-cost text route"}</strong>
            </div>
          </div>

          <div className={`advanced-settings ${advancedOpen ? "is-open" : ""}`}>
            <button className="advanced-toggle" onClick={() => setAdvancedOpen((open) => !open)}>
              <span>
                <Settings2 size={16} />
                Trace controls
              </span>
              <ChevronDown size={17} />
            </button>
            {advancedOpen && (
              <div className="advanced-body">
                <label>
                  <span>
                    Color layers <b>{settings.colors}</b>
                  </span>
                  <input
                    type="range"
                    min="4"
                    max="32"
                    value={settings.colors}
                    onChange={(event) => setSettings((value) => ({ ...value, colors: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  <span>
                    Fine detail <b>{settings.detail}</b>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={settings.detail}
                    onChange={(event) => setSettings((value) => ({ ...value, detail: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  <span>
                    Curve smoothing <b>{settings.smoothing}</b>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={settings.smoothing}
                    onChange={(event) => setSettings((value) => ({ ...value, smoothing: Number(event.target.value) }))}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.removeBackground}
                    onChange={async (event) => {
                      const nextSettings = { ...settings, removeBackground: event.target.checked };
                      setSettings(nextSettings);
                      if (sourceBlobRef.current) {
                        setRunning(true);
                        setError("");
                        setProgress(40);
                        setProgressLabel("Rebuilding vector layers");
                        try {
                          await runVectorizer(sourceBlobRef.current, nextSettings);
                        } catch (reason) {
                          setError(reason instanceof Error ? reason.message : "The local trace could not finish.");
                        } finally {
                          setRunning(false);
                        }
                      }
                    }}
                  />
                  <span>Remove background (make transparent)</span>
                </label>
                {sourceBlobRef.current && (
                  <button className="retrace-button" disabled={running} onClick={handleRetrace}>
                    <RefreshCw size={14} />
                    Retrace locally without AI credits
                  </button>
                )}
              </div>
            )}
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="composer-action">
            <button className="primary-button create-button" disabled={running} onClick={handleCreate}>
              {running ? <LoaderCircle className="spinner" size={19} /> : <WandSparkles size={19} />}
              {running ? progressLabel : reference ? "Restyle & vectorize" : "Generate & vectorize"}
            </button>
            {running ? (
              <div className="pipeline-progress" aria-live="polite">
                <span style={{ width: `${progress}%` }} />
                <small>{progress}%</small>
              </div>
            ) : (
              <p className="result-summary">
                {result.paths} paths / {result.groups} layers / {outputSize}
              </p>
            )}
          </div>
        </aside>

        <section className={`output-panel ${sourceOpen ? "is-split" : ""}`}>
          <div className="preview-pane">
            <div className="pane-toolbar">
              <div className="toolbar-left">
                <div className="view-switch" aria-label="Preview mode">
                  <button className={previewMode === "vector" ? "active" : ""} onClick={() => setPreviewMode("vector")}>
                    Vector
                  </button>
                  <button
                    className={previewMode === "raster" ? "active" : ""}
                    disabled={!rasterUrl}
                    onClick={() => setPreviewMode("raster")}
                  >
                    Raster
                  </button>
                </div>
                <div className="preview-meta">
                  <span>{result.width} x {result.height}</span>
                  <span>{lastModel}</span>
                </div>
              </div>

              <div className="toolbar-center">
                <button
                  className={`source-toggle-button ${sourceOpen ? "is-active" : ""}`}
                  onClick={() => setSourceOpen((shown) => !shown)}
                >
                  <Code2 size={14} />
                  {sourceOpen ? "Hide SVG source" : "Show SVG source"}
                </button>
              </div>

              <div className="toolbar-actions">
                <div className="zoom-control">
                  <button onClick={() => setZoom((value) => Math.max(50, value - 25))} aria-label="Zoom out">
                    <Minus size={14} />
                  </button>
                  <span>{zoom}%</span>
                  <button onClick={() => setZoom((value) => Math.min(300, value + 25))} aria-label="Zoom in">
                    <Plus size={14} />
                  </button>
                </div>
                <button className="download-button" onClick={() => downloadText(svgCode, "curvia-vector.svg")}>
                  <Download size={16} />
                  Download SVG
                </button>
              </div>
            </div>

            <div className="preview-stage">
              <div className="stage-grid" />
              <div
                className={`artboard ${running ? "is-processing" : ""}`}
                style={
                  {
                    width: artboardWidth,
                    height: artboardHeight,
                    ["--artboard-h" as string]: `${artboardHeight}px`,
                  } as React.CSSProperties
                }
              >
                {previewMode === "vector" ? (
                  <div
                    ref={previewRef}
                    className="vector-canvas"
                    onMouseOver={(event) => handlePreviewPointer(event.target)}
                    onMouseOut={() => setHoveredId("")}
                    dangerouslySetInnerHTML={{ __html: svgCode }}
                  />
                ) : (
                  <img src={rasterUrl} alt="AI-generated raster before vectorization" />
                )}
                {running && (
                  <div className="processing-overlay">
                    <span className="scan-line" />
                    <div>
                      <LoaderCircle className="spinner" size={22} />
                      <strong>{progressLabel}</strong>
                      <span>{progress}% complete</span>
                    </div>
                  </div>
                )}
              </div>
              {!running && hoveredId && (
                <div className="hover-label">
                  <Code2 size={13} /> #{hoveredId}
                </div>
              )}
            </div>
          </div>

          {sourceOpen && (
            <div className="code-pane">
              <div className="code-toolbar">
                <div>
                  <Code2 size={15} />
                  <strong>SVG SOURCE</strong>
                  <span>Syntax highlighted / hover a path to locate it</span>
                </div>
                <div>
                  {editing ? (
                    <>
                      <button onClick={() => setEditing(false)}>Cancel</button>
                      <button className="apply-code" onClick={applyEdit}>
                        <Check size={14} /> Apply SVG
                      </button>
                    </>
                  ) : (
                    <button onClick={beginEditing}>
                      <Code2 size={14} /> Edit source
                    </button>
                  )}
                  <button onClick={handleCopy}>
                    {copied ? <Check size={14} /> : <Clipboard size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              {editing ? (
                <textarea
                  className="source-editor"
                  value={draftCode}
                  onChange={(event) => setDraftCode(event.target.value)}
                  spellCheck={false}
                  aria-label="Edit SVG source"
                />
              ) : (
                <div className="source-code" role="region" aria-label="Highlighted SVG source" tabIndex={0}>
                  {codeLines.map((line, index) => {
                    const id = line.match(/\sid="([^"]+)"/)?.[1] || "";
                    return (
                      <div
                        className={`source-line ${id && id === hoveredId ? "is-highlighted" : ""}`}
                        key={`${index}-${line.slice(0, 24)}`}
                        onMouseEnter={() => id && setHoveredId(id)}
                        onMouseLeave={() => setHoveredId("")}
                      >
                        <span className="line-number">{String(index + 1).padStart(2, "0")}</span>
                        <code><SyntaxLine line={line} /></code>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <ApiKeyDialog
        open={settingsOpen}
        currentKey={apiKey}
        onClose={() => setSettingsOpen(false)}
        onSave={saveApiKey}
      />

      {copied && (
        <div className="toast" role="status">
          <Check size={15} /> SVG copied to clipboard
        </div>
      )}
    </div>
  );
}
