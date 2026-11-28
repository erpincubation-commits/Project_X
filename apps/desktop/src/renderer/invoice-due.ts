/** Display-only reminder based on the workstation's local calendar date. */
export function invoiceDueLabel(status:string,dueDate:string,outstanding:string,asOf:string):string {
  if(status!=='POSTED'||!/^\d+(?:\.\d+)?$/.test(outstanding)||!/[1-9]/.test(outstanding)||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return '';
  if(dueDate<asOf)return 'Overdue';
  if(dueDate===asOf)return 'Due today';
  return '';
}
