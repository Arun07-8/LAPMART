
function getmainOrderStatus(orderedItems) {
  if (!orderedItems || orderedItems.length === 0) return 'Pending';
  const statuses = orderedItems.map(item => item.status);
  if (statuses.every(status => status === 'Cancelled')) return 'Cancelled';
  if (statuses.includes('Return Request')) return 'Return Request';
  if (statuses.includes('Returned')) return 'Returned';
  if (statuses.includes('Shipped')) return 'Shipped';
  if (statuses.includes('Processing')) return 'Processing';
  if (statuses.includes('Pending')) return 'Pending';
  if (statuses.includes('Payment Failed')) return 'Payment Failed';
  if (statuses.every(status => status === 'Delivered')) return 'Delivered';
  return 'Processing'; 
}
module.exports={getmainOrderStatus}