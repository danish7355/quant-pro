import React, { useRef } from 'react';

export function PriceFlasher({ price, valuePrefix = '$', className = '' }: { price: number; valuePrefix?: string; className?: string }) {
  const prevPriceRef = useRef(price);
  const prevPrice = prevPriceRef.current;
  prevPriceRef.current = price;

  let flashClass = '';
  if (price > prevPrice) {
    flashClass = 'animate-flash-green';
  } else if (price < prevPrice) {
    flashClass = 'animate-flash-red';
  }

  return (
    <span key={price} className={`${className} ${flashClass} inline-block`}>
      {valuePrefix}{price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 8 })}
    </span>
  );
}
