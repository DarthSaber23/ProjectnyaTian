import type { Prisma } from "@prisma/client";

/**
 * Writes positions 0..n-1 in the given order. Postgres checks the (productId, position) unique key row by row, so
 * every photo first moves to position + 100; a single decrementing update could collide mid-statement.
 */
export async function renumber(tx: Prisma.TransactionClient, productId: string, orderedIds: string[]): Promise<void> {
  await tx.productImage.updateMany({ where: { productId }, data: { position: { increment: 100 } } });
  for (const [position, id] of orderedIds.entries()) {
    await tx.productImage.update({ where: { id }, data: { position } });
  }
}
